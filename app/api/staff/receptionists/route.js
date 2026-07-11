import { getAdminDb, getAdminAuth } from '@/lib/firebaseAdmin'
import { STAFF_MODULES } from '@/models/Staff'

function sanitizePermissions(input) {
  const perms = {}
  for (const { value } of STAFF_MODULES) perms[value] = !!input?.[value]
  return perms
}

async function verifyDoctor(request) {
  const idToken = (request.headers.get('Authorization') ?? '').replace('Bearer ', '').trim()
  if (!idToken) return null
  const adminAuth = await getAdminAuth()
  let decoded
  try { decoded = await adminAuth.verifyIdToken(idToken) } catch { return null }
  const db   = getAdminDb()
  const snap = await db.collection('users').doc(decoded.uid).collection('profile').doc('doctor').get()
  if (!snap.exists) return null
  return { uid: decoded.uid, profile: snap.data() }
}

// Verify caller can act on targetUid — either it's themselves or they share an org
async function resolveTargetUid(caller, targetUid) {
  if (!targetUid || targetUid === caller.uid) return caller.uid

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
