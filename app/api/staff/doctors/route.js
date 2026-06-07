import { getAdminDb, getAdminAuth } from '@/lib/firebaseAdmin'
import { FieldValue } from 'firebase-admin/firestore'

function genInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 16 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

async function verifyClinicAdmin(request) {
  const idToken = (request.headers.get('Authorization') ?? '').replace('Bearer ', '').trim()
  if (!idToken) return null
  const adminAuth = await getAdminAuth()
  let decoded
  try { decoded = await adminAuth.verifyIdToken(idToken) } catch { return null }
  const db   = getAdminDb()
  const snap = await db.collection('users').doc(decoded.uid).collection('profile').doc('doctor').get()
  const data = snap.data()
  return data?.clinicRole === 'clinic_admin' ? { uid: decoded.uid, ...data } : null
}

export async function POST(request) {
  const caller = await verifyClinicAdmin(request)
  if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { firstName, lastName, email, clinicName, specialization, phone, password } = await request.json()
  if (!firstName?.trim() || !lastName?.trim() || !email?.trim() || !password?.trim()) {
    return Response.json({ error: 'firstName, lastName, email and password are required.' }, { status: 400 })
  }

  const adminAuth = await getAdminAuth()
  const db        = getAdminDb()

  try {
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
        clinicName:     clinicName?.trim()     ?? '',
        specialization: specialization?.trim() ?? '',
        phone:          phone?.trim()          ?? '',
        inviteCode:     genInviteCode(),
        subscription:   { status: 'trial', trialEndsAt: new Date(Date.now() + 7 * 86400000).toISOString() },
        isAdmin:        false,
        viewOnly:       false,
        clinicRole:     'doctor',
        managedBy:      caller.uid,
        managedDoctors: null,
        createdAt:      now,
        updatedAt:      now,
      })

    // Link new doctor to the clinic admin's managedDoctors list
    await db.collection('users').doc(caller.uid)
      .collection('profile').doc('doctor')
      .update({ managedDoctors: FieldValue.arrayUnion(userRecord.uid) })

    return Response.json({ uid: userRecord.uid, email: userRecord.email })
  } catch (err) {
    const msg = err.code === 'auth/email-already-exists'
      ? 'An account with this email already exists.'
      : err.message
    return Response.json({ error: msg }, { status: 400 })
  }
}
