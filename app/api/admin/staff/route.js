import { getAdminDb, getAdminAuth } from '@/lib/firebaseAdmin'
import { createAdminClient } from '@/lib/supabase'
import { STAFF_MODULES } from '@/models/Staff'

function sanitizePermissions(input) {
  const perms = {}
  for (const { value } of STAFF_MODULES) perms[value] = !!input?.[value]
  return perms
}

// The platform admin's own auth is always Firebase — admin accounts aren't
// per-clinic FB/SB choices. Only the TARGET clinic/receptionist being managed
// may be on either backend.
async function verifyAdmin(request) {
  const idToken = (request.headers.get('Authorization') ?? '').replace('Bearer ', '').trim()
  if (!idToken) return null
  const adminAuth = await getAdminAuth()
  let decoded
  try { decoded = await adminAuth.verifyIdToken(idToken) } catch { return null }
  const db   = getAdminDb()
  const snap = await db.collection('users').doc(decoded.uid).collection('profile').doc('doctor').get()
  return snap.data()?.isAdmin ? decoded : null
}

// GET /api/admin/staff?doctorId=xxx  — list receptionists for a clinic
export async function GET(request) {
  const caller = await verifyAdmin(request)
  if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const doctorId = new URL(request.url).searchParams.get('doctorId')
  if (!doctorId) return Response.json({ error: 'doctorId required' }, { status: 400 })

  const supabaseAdmin = createAdminClient()
  const { data: sbDoctor } = await supabaseAdmin.from('doctors').select('id').eq('id', doctorId).maybeSingle().catch(() => ({ data: null }))

  if (sbDoctor) {
    const { data: rows } = await supabaseAdmin.from('receptionists').select('*').eq('doctor_id', doctorId)
    const staff = (rows ?? []).map(d => ({
      uid: d.id, name: d.name, email: d.email, role: d.role ?? 'receptionist',
      viewOnly: d.view_only ?? false, permissions: sanitizePermissions(d.permissions), createdAt: d.created_at ?? null,
    })).sort((a, b) => (a.createdAt ?? '') > (b.createdAt ?? '') ? -1 : 1)
    return Response.json({ staff })
  }

  const db   = getAdminDb()
  const snap = await db.collection('receptionists').where('doctorId', '==', doctorId).get()

  const staff = []
  snap.forEach(doc => {
    const d = doc.data()
    staff.push({
      uid:         doc.id,
      name:        d.name,
      email:       d.email,
      role:        d.role ?? 'receptionist',
      viewOnly:    d.viewOnly ?? false,
      permissions: sanitizePermissions(d.permissions),
      createdAt:   d.createdAt ?? null,
    })
  })

  staff.sort((a, b) => (a.createdAt ?? '') > (b.createdAt ?? '') ? -1 : 1)
  return Response.json({ staff })
}

// POST /api/admin/staff  — create a receptionist account for a clinic
export async function POST(request) {
  const caller = await verifyAdmin(request)
  if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { doctorId, name, email, password } = await request.json()
  if (!doctorId || !name?.trim() || !email?.trim() || !password?.trim()) {
    return Response.json({ error: 'doctorId, name, email and password are required.' }, { status: 400 })
  }

  const supabaseAdmin = createAdminClient()
  const { data: sbDoctor } = await supabaseAdmin.from('doctors').select('id').eq('id', doctorId).maybeSingle().catch(() => ({ data: null }))

  if (sbDoctor) {
    try {
      const { data: userData, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: email.trim(), password: password.trim(), email_confirm: true,
      })
      if (createErr) throw createErr

      const { error: insertErr } = await supabaseAdmin.from('receptionists').insert({
        id: userData.user.id, doctor_id: doctorId, name: name.trim(), email: email.trim(),
        role: 'receptionist', created_at: new Date().toISOString(),
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
      name:      name.trim(),
      email:     email.trim(),
      doctorId,
      role:      'receptionist',
      createdAt: new Date().toISOString(),
    })

    return Response.json({ uid: userRecord.uid, email: userRecord.email })
  } catch (err) {
    const msg = err.code === 'auth/email-already-exists'
      ? 'An account with this email already exists.'
      : err.message
    return Response.json({ error: msg }, { status: 400 })
  }
}

// DELETE /api/admin/staff  — remove a receptionist account
export async function DELETE(request) {
  const caller = await verifyAdmin(request)
  if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { uid } = await request.json()
  if (!uid) return Response.json({ error: 'uid required' }, { status: 400 })

  const supabaseAdmin = createAdminClient()
  const { data: sbRec } = await supabaseAdmin.from('receptionists').select('id').eq('id', uid).maybeSingle().catch(() => ({ data: null }))

  if (sbRec) {
    await supabaseAdmin.auth.admin.deleteUser(uid).catch(() => {})
    await supabaseAdmin.from('receptionists').delete().eq('id', uid)
    return Response.json({ ok: true })
  }

  const adminAuth = await getAdminAuth()
  const db        = getAdminDb()

  await adminAuth.deleteUser(uid).catch(() => {})
  await db.collection('receptionists').doc(uid).delete()
  return Response.json({ ok: true })
}
