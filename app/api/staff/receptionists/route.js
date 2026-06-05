import { getAdminDb, getAdminAuth } from '@/lib/firebaseAdmin'

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

// GET /api/staff/receptionists — list receptionists for the current doctor
export async function GET(request) {
  const caller = await verifyDoctor(request)
  if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const db   = getAdminDb()
  const snap = await db.collection('receptionists').where('doctorId', '==', caller.uid).get()

  const receptionists = []
  snap.forEach(doc => {
    const d = doc.data()
    receptionists.push({ uid: doc.id, name: d.name, email: d.email, createdAt: d.createdAt ?? null })
  })
  receptionists.sort((a, b) => (a.createdAt ?? '') > (b.createdAt ?? '') ? -1 : 1)
  return Response.json({ receptionists })
}

// POST /api/staff/receptionists — create a receptionist account for the current doctor
export async function POST(request) {
  const caller = await verifyDoctor(request)
  if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, email, password } = await request.json()
  if (!name?.trim() || !email?.trim() || !password?.trim()) {
    return Response.json({ error: 'name, email and password are required.' }, { status: 400 })
  }
  if (password.trim().length < 6) {
    return Response.json({ error: 'Password must be at least 6 characters.' }, { status: 400 })
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
      doctorId:  caller.uid,
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

// DELETE /api/staff/receptionists — remove a receptionist (only if they belong to this doctor)
export async function DELETE(request) {
  const caller = await verifyDoctor(request)
  if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { uid } = await request.json()
  if (!uid) return Response.json({ error: 'uid required' }, { status: 400 })

  const db   = getAdminDb()
  const snap = await db.collection('receptionists').doc(uid).get()
  if (!snap.exists || snap.data()?.doctorId !== caller.uid) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  const adminAuth = await getAdminAuth()
  await adminAuth.deleteUser(uid).catch(() => {})
  await db.collection('receptionists').doc(uid).delete()
  return Response.json({ ok: true })
}
