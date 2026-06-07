import { getAdminDb, getAdminAuth } from '@/lib/firebaseAdmin'

export async function GET(request) {
  const idToken = (request.headers.get('Authorization') ?? '').replace('Bearer ', '').trim()
  if (!idToken) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const adminAuth = await getAdminAuth()

    // ── 0. Verify the caller is an admin ──────────────────────────────────────
    let decoded
    try {
      decoded = await adminAuth.verifyIdToken(idToken)
    } catch {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const db         = getAdminDb()
    const callerSnap = await db
      .collection('users').doc(decoded.uid)
      .collection('profile').doc('doctor')
      .get()
    if (!callerSnap.data()?.isAdmin) {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }

    // ── 1. Collect Firebase Auth metadata for all users ───────────────────────
    const authMap = {}
    let pageToken
    do {
      const result = await adminAuth.listUsers(1000, pageToken)
      result.users.forEach(u => {
        authMap[u.uid] = {
          lastSignInTime: u.metadata.lastSignInTime ?? null,
          creationTime:   u.metadata.creationTime   ?? null,
          emailVerified:  u.emailVerified,
          disabled:       u.disabled,
        }
      })
      pageToken = result.pageToken
    } while (pageToken)

    // ── 2. Read all doctor profiles via collectionGroup ───────────────────────
    const snap = await db.collectionGroup('profile').get()

    const doctors = []
    snap.forEach(docSnap => {
      if (docSnap.id !== 'doctor') return
      const d   = docSnap.data()
      const uid = docSnap.ref.parent.parent.id
      const au  = authMap[uid] ?? {}

      if (d.isAdmin) return  // don't expose admin accounts in the list

      doctors.push({
        uid,
        firstName:      d.firstName      ?? '',
        lastName:       d.lastName       ?? '',
        email:          d.email          ?? '',
        clinicName:     d.clinicName     ?? '',
        specialization: d.specialization ?? '',
        phone:          d.phone          ?? '',
        isAdmin:        d.isAdmin        ?? false,
        viewOnly:       d.viewOnly       ?? false,
        clinicRole:     d.clinicRole     ?? 'doctor',
        managedDoctors: d.managedDoctors ?? [],
        managedBy:      d.managedBy      ?? null,
        subscription:   d.subscription   ?? null,
        createdAt:      d.createdAt      ?? au.creationTime ?? null,
        lastSignInTime: au.lastSignInTime ?? null,
        emailVerified:  au.emailVerified  ?? false,
        disabled:       au.disabled       ?? false,
      })
    })

    doctors.sort((a, b) => new Date(b.createdAt ?? 0) - new Date(a.createdAt ?? 0))

    return Response.json({ doctors, total: doctors.length })
  } catch (err) {
    console.error('[admin/doctors]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
