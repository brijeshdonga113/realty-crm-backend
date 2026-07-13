import { getAdminDb, getAdminAuth } from '@/lib/firebaseAdmin'
import { createAdminClient } from '@/lib/supabase'
import { verifyBearerToken } from '@/lib/serverAuth'
import { STAFF_MODULES } from '@/models/Staff'

function sanitizePermissions(input) {
  const perms = {}
  for (const { value } of STAFF_MODULES) perms[value] = !!input?.[value]
  return perms
}

async function verifyDoctor(request) {
  const caller = await verifyBearerToken(request)
  if (!caller) return null

  if (caller.backend === 'SB') {
    const { data } = await createAdminClient().from('doctors').select('id, organization_id').eq('id', caller.uid).maybeSingle()
    if (!data) return null
    return { uid: caller.uid, backend: 'SB', profile: { organizationId: data.organization_id } }
  }

  const db   = getAdminDb()
  const snap = await db.collection('users').doc(caller.uid).collection('profile').doc('doctor').get()
  if (!snap.exists) return null
  return { uid: caller.uid, backend: 'FB', profile: snap.data() }
}

// Verify caller can act on targetUid — either it's themselves or they share an
// org. Branch-switching (targetUid !== caller.uid) is FB-only — org support
// for SB accounts is deferred, see plan.
async function resolveTargetUid(caller, targetUid) {
  if (!targetUid || targetUid === caller.uid) return caller.uid
  if (caller.backend === 'SB') return null

  const db = getAdminDb()
  const targetSnap = await db.collection('users').doc(targetUid).collection('profile').doc('doctor').get()
  if (!targetSnap.exists) return null

  const callerOrg = caller.profile?.organizationId
  const targetOrg = targetSnap.data()?.organizationId
  if (!callerOrg || callerOrg !== targetOrg) return null

  return targetUid
}

// GET — list receptionists for the active branch
export async function GET(request) {
  const caller = await verifyDoctor(request)
  if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const branchUid = new URL(request.url).searchParams.get('branchUid')
  const doctorId  = await resolveTargetUid(caller, branchUid)
  if (!doctorId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  if (caller.backend === 'SB') {
    const { data: rows } = await createAdminClient().from('receptionists').select('*').eq('doctor_id', doctorId)
    const receptionists = (rows ?? []).map(d => ({
      uid: d.id, name: d.name, email: d.email, role: d.role ?? 'receptionist',
      viewOnly: d.view_only ?? false, permissions: sanitizePermissions(d.permissions), createdAt: d.created_at ?? null,
    })).sort((a, b) => (a.createdAt ?? '') > (b.createdAt ?? '') ? -1 : 1)
    return Response.json({ receptionists })
  }

  const db   = getAdminDb()
  const snap = await db.collection('receptionists').where('doctorId', '==', doctorId).get()

  const receptionists = []
  snap.forEach(doc => {
    const d = doc.data()
    receptionists.push({
      uid:         doc.id,
      name:        d.name,
      email:       d.email,
      role:        d.role ?? 'receptionist',
      viewOnly:    d.viewOnly ?? false,
      permissions: sanitizePermissions(d.permissions),
      createdAt:   d.createdAt ?? null,
    })
  })
  receptionists.sort((a, b) => (a.createdAt ?? '') > (b.createdAt ?? '') ? -1 : 1)
  return Response.json({ receptionists })
}

// POST — create a receptionist account for the active branch
export async function POST(request) {
  const caller = await verifyDoctor(request)
  if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, email, password, role, permissions, branchUid } = await request.json()
  if (!name?.trim() || !email?.trim() || !password?.trim()) {
    return Response.json({ error: 'name, email and password are required.' }, { status: 400 })
  }
  if (password.trim().length < 6) {
    return Response.json({ error: 'Password must be at least 6 characters.' }, { status: 400 })
  }

  const doctorId = await resolveTargetUid(caller, branchUid)
  if (!doctorId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  if (caller.backend === 'SB') {
    try {
      const supabaseAdmin = createAdminClient()
      const { data: userData, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: email.trim(), password: password.trim(), email_confirm: true,
      })
      if (createErr) throw createErr

      const { error: insertErr } = await supabaseAdmin.from('receptionists').insert({
        id: userData.user.id, doctor_id: doctorId, name: name.trim(), email: email.trim(),
        role: role ?? 'receptionist', view_only: false, permissions: sanitizePermissions(permissions),
        created_at: new Date().toISOString(),
      })
      if (insertErr) {
        await supabaseAdmin.auth.admin.deleteUser(userData.user.id).catch(() => {})
        throw insertErr
      }

      return Response.json({ uid: userData.user.id, email: userData.user.email })
    } catch (err) {
      const msg = err.message?.includes('already been registered')
        ? 'An account with this email already exists.'
        : (err.message || 'Failed to create account.')
      return Response.json({ error: msg }, { status: 400 })
    }
  }

  const adminAuth = await getAdminAuth()
  const db        = getAdminDb()

  try {
    const userRecord = await adminAuth.createUser({
      email:       email.trim(),
      password:    password.trim(),
      displayName: name.trim(),
    })

    await db.collection('receptionists').doc(userRecord.uid).set({
      name:        name.trim(),
      email:       email.trim(),
      doctorId,
      role:        role ?? 'receptionist',
      viewOnly:    false,
      permissions: sanitizePermissions(permissions),
      createdAt:   new Date().toISOString(),
    })

    return Response.json({ uid: userRecord.uid, email: userRecord.email })
  } catch (err) {
    const msg = err.code === 'auth/email-already-exists'
      ? 'An account with this email already exists.'
      : err.message
    return Response.json({ error: msg }, { status: 400 })
  }
}

// PATCH — toggle viewOnly and/or per-module permissions for a receptionist
// (must belong to the active branch). `permissions` is merged with the
// account's existing permissions, so a caller can flip a single module
// without resetting the others.
export async function PATCH(request) {
  const caller = await verifyDoctor(request)
  if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { uid, viewOnly, permissions, branchUid } = await request.json()
  if (!uid || (viewOnly === undefined && permissions === undefined)) {
    return Response.json({ error: 'uid and (viewOnly or permissions) required' }, { status: 400 })
  }

  const doctorId = await resolveTargetUid(caller, branchUid)
  if (!doctorId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  if (caller.backend === 'SB') {
    const supabaseAdmin = createAdminClient()
    const { data: rec } = await supabaseAdmin.from('receptionists').select('*').eq('id', uid).maybeSingle()
    if (!rec || rec.doctor_id !== doctorId) return Response.json({ error: 'Not found' }, { status: 404 })

    const update = {}
    if (viewOnly !== undefined) update.view_only = !!viewOnly
    if (permissions !== undefined) {
      const current = sanitizePermissions(rec.permissions)
      update.permissions = sanitizePermissions({ ...current, ...permissions })
    }
    await supabaseAdmin.from('receptionists').update(update).eq('id', uid)
    return Response.json({ ok: true, viewOnly: update.view_only, permissions: update.permissions })
  }

  const db   = getAdminDb()
  const snap = await db.collection('receptionists').doc(uid).get()
  if (!snap.exists || snap.data()?.doctorId !== doctorId) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  const update = {}
  if (viewOnly !== undefined) update.viewOnly = !!viewOnly
  if (permissions !== undefined) {
    const current = sanitizePermissions(snap.data()?.permissions)
    update.permissions = sanitizePermissions({ ...current, ...permissions })
  }

  await db.collection('receptionists').doc(uid).update(update)
  return Response.json({ ok: true, ...update })
}

// DELETE — remove a receptionist (must belong to the active branch)
export async function DELETE(request) {
  const caller = await verifyDoctor(request)
  if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { uid, branchUid } = await request.json()
  if (!uid) return Response.json({ error: 'uid required' }, { status: 400 })

  const doctorId = await resolveTargetUid(caller, branchUid)
  if (!doctorId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  if (caller.backend === 'SB') {
    const supabaseAdmin = createAdminClient()
    const { data: rec } = await supabaseAdmin.from('receptionists').select('doctor_id').eq('id', uid).maybeSingle()
    if (!rec || rec.doctor_id !== doctorId) return Response.json({ error: 'Not found' }, { status: 404 })
    await supabaseAdmin.auth.admin.deleteUser(uid).catch(() => {})
    await supabaseAdmin.from('receptionists').delete().eq('id', uid)
    return Response.json({ ok: true })
  }

  const db   = getAdminDb()
  const snap = await db.collection('receptionists').doc(uid).get()
  if (!snap.exists || snap.data()?.doctorId !== doctorId) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  const adminAuth = await getAdminAuth()
  await adminAuth.deleteUser(uid).catch(() => {})
  await db.collection('receptionists').doc(uid).delete()
  return Response.json({ ok: true })
}
