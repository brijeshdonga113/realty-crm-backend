import { getAdminDb, getAdminAuth } from '@/lib/firebaseAdmin'
import { createAdminClient } from '@/lib/supabase'

async function listSupabaseDoctors() {
  const supabaseAdmin = createAdminClient()

  // Supabase Auth Admin's listUsers() uses page/perPage, not a page-token loop
  // like Firebase's — run it to completion on its own terms, don't try to
  // unify the two APIs' pagination mechanics.
  const authMap = {}
  let page = 1
  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) break
    data.users.forEach(u => {
      authMap[u.id] = {
        lastSignInTime: u.last_sign_in_at ?? null,
        creationTime:   u.created_at ?? null,
        emailVerified:  !!u.email_confirmed_at,
        disabled:       u.banned_until ? new Date(u.banned_until) > new Date() : false,
      }
    })
    if (data.users.length < 1000) break
    page += 1
  }

  const { data: rows, error } = await supabaseAdmin.from('doctors').select('*')
  if (error) return []

  return rows.filter(d => !d.is_admin).map(d => {
    const au = authMap[d.id] ?? {}
    return {
      uid: d.id,
      backend: 'SB',
      firstName:      d.first_name      ?? '',
      lastName:       d.last_name       ?? '',
      email:          d.email           ?? '',
      clinicName:     d.clinic_name     ?? '',
      specialization: d.specialization  ?? '',
      phone:          d.phone           ?? '',
      isAdmin:        d.is_admin        ?? false,
      viewOnly:       d.view_only       ?? false,
      logoUrl:        d.logo_url        ?? '',
      clinicRole:     d.clinic_role     ?? 'doctor',
      managedDoctors: d.managed_doctors ?? [],
      managedBy:      d.managed_by      ?? null,
      subscription:   d.subscription    ?? null,
      createdAt:      d.created_at      ?? au.creationTime ?? null,
      lastSignInTime: au.lastSignInTime ?? null,
      emailVerified:  au.emailVerified  ?? false,
      disabled:       au.disabled       ?? false,
    }
  })
}

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
        backend: 'FB',
        firstName:      d.firstName      ?? '',
        lastName:       d.lastName       ?? '',
        email:          d.email          ?? '',
        clinicName:     d.clinicName     ?? '',
        specialization: d.specialization ?? '',
        phone:          d.phone          ?? '',
        isAdmin:        d.isAdmin        ?? false,
        viewOnly:       d.viewOnly       ?? false,
        logoUrl:        d.logoUrl        ?? '',
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

    const supabaseDoctors = await listSupabaseDoctors().catch(err => {
      console.error('[admin/doctors] Supabase listing failed', err)
      return []
    })

    const allDoctors = [...doctors, ...supabaseDoctors]
    allDoctors.sort((a, b) => new Date(b.createdAt ?? 0) - new Date(a.createdAt ?? 0))

    return Response.json({ doctors: allDoctors, total: allDoctors.length })
  } catch (err) {
    console.error('[admin/doctors]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
