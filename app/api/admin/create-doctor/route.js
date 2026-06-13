import { getAdminDb, getAdminAuth } from '@/lib/firebaseAdmin'
import { FieldValue } from 'firebase-admin/firestore'

function genInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 16 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

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

export async function POST(request) {
  const caller = await verifyAdmin(request)
  if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { firstName, lastName, email, clinicName, specialization, phone, password, clinicRole, managedByUid } = await request.json()
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

    const now  = new Date().toISOString()
    const role = clinicRole === 'clinic_admin' ? 'clinic_admin' : 'doctor'

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
        clinicRole:     role,
        managedDoctors: role === 'clinic_admin' ? [] : null,
        managedBy:      role === 'doctor' && managedByUid?.trim() ? managedByUid.trim() : null,
        createdAt:      now,
        updatedAt:      now,
      })

    // Append this doctor to the clinic admin's managedDoctors list
    if (role === 'doctor' && managedByUid?.trim()) {
      await db.collection('users').doc(managedByUid.trim())
        .collection('profile').doc('doctor')
        .update({ managedDoctors: FieldValue.arrayUnion(userRecord.uid) })
    }

    return Response.json({ uid: userRecord.uid, email: userRecord.email })
  } catch (err) {
    const msg = err.code === 'auth/email-already-exists'
      ? 'An account with this email already exists.'
      : err.message
    return Response.json({ error: msg }, { status: 400 })
  }
}

// PATCH — update viewOnly or isAdmin flags
export async function PATCH(request) {
  const caller = await verifyAdmin(request)
  if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { uid, viewOnly, isAdmin } = await request.json()
  if (!uid) return Response.json({ error: 'uid required' }, { status: 400 })

  const db      = getAdminDb()
  const updates = {}
  if (viewOnly !== undefined) updates.viewOnly = viewOnly
  if (isAdmin  !== undefined) updates.isAdmin  = isAdmin

  await db.collection('users').doc(uid).collection('profile').doc('doctor').update(updates)
  return Response.json({ ok: true })
}
