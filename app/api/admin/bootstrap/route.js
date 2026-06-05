import { getAdminDb, getAdminAuth } from '@/lib/firebaseAdmin'

async function hasExistingAdmin(db) {
  const snap = await db.collectionGroup('profile').get()
  for (const doc of snap.docs) {
    if (doc.id === 'doctor' && doc.data()?.isAdmin) return true
  }
  return false
}

// GET — check whether first-time setup is still available
export async function GET() {
  try {
    const db = getAdminDb()
    const adminExists = await hasExistingAdmin(db)
    return Response.json({ setupAvailable: !adminExists })
  } catch (err) {
    return Response.json({ error: 'Server error' }, { status: 500 })
  }
}

// POST — create the one and only first admin account
export async function POST(request) {
  const { email, password, firstName, lastName } = await request.json()

  if (!email?.trim() || !password?.trim() || !firstName?.trim() || !lastName?.trim()) {
    return Response.json({ error: 'All fields are required.' }, { status: 400 })
  }
  if (password.trim().length < 8) {
    return Response.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })
  }

  try {
    const db    = getAdminDb()
    const adminAuth = await getAdminAuth()

    // Block if an admin already exists — this endpoint is one-time only
    if (await hasExistingAdmin(db)) {
      return Response.json({ error: 'Setup already complete. Please log in.' }, { status: 403 })
    }

    const userRecord = await adminAuth.createUser({
      email:       email.trim(),
      password:    password.trim(),
      displayName: `${firstName.trim()} ${lastName.trim()}`,
    })

    const now = new Date().toISOString()
    await db.collection('users').doc(userRecord.uid)
      .collection('profile').doc('doctor')
      .set({
        firstName:      firstName.trim(),
        lastName:       lastName.trim(),
        email:          email.trim(),
        clinicName:     '',
        specialization: '',
        phone:          '',
        inviteCode:     '',
        subscription:   null,
        isAdmin:        true,
        viewOnly:       false,
        createdAt:      now,
        updatedAt:      now,
      })

    return Response.json({ ok: true, uid: userRecord.uid })
  } catch (err) {
    const msg = err.code === 'auth/email-already-exists'
      ? 'An account with this email already exists.'
      : err.message
    return Response.json({ error: msg }, { status: 400 })
  }
}
