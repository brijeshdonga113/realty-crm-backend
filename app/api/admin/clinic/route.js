import { getAdminDb, getAdminAuth } from '@/lib/firebaseAdmin'

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

// GET /api/admin/clinic?uid=xxx — full clinic overview
export async function GET(request) {
  const caller = await verifyAdmin(request)
  if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const uid = new URL(request.url).searchParams.get('uid')
  if (!uid) return Response.json({ error: 'uid required' }, { status: 400 })

  const db = getAdminDb()

  try {
    const [profileSnap, patientsSnap, invoicesSnap, adminAuth] = await Promise.all([
      db.collection('users').doc(uid).collection('profile').doc('doctor').get(),
      db.collection('users').doc(uid).collection('patients').get(),
      db.collection('users').doc(uid).collection('invoices').get(),
      getAdminAuth(),
    ])

    if (!profileSnap.exists) return Response.json({ error: 'Clinic not found' }, { status: 404 })

    const profile = profileSnap.data()

    // Fetch org if this clinic belongs to one
    let orgData = null
    if (profile.organizationId) {
      const orgSnap = await db.collection('organizations').doc(profile.organizationId).get()
      if (orgSnap.exists) orgData = { id: orgSnap.id, ...orgSnap.data() }
    }

    // Firebase Auth metadata
    let authMeta = {}
    try {
      const user = await adminAuth.getUser(uid)
      authMeta = {
        lastSignInTime: user.metadata.lastSignInTime ?? null,
        creationTime:   user.metadata.creationTime   ?? null,
        emailVerified:  user.emailVerified,
        disabled:       user.disabled,
      }
    } catch {}

    // Patients
    const patientCount = patientsSnap.size
    const recentPatients = []
    patientsSnap.forEach(doc => {
      const d = doc.data()
      recentPatients.push({ id: doc.id, firstName: d.firstName ?? '', lastName: d.lastName ?? '', createdAt: d.createdAt ?? null })
    })
    recentPatients.sort((a, b) => (b.createdAt ?? '') > (a.createdAt ?? '') ? 1 : -1)

    // Financials
    let totalRevenue = 0, pendingAmount = 0, totalInvoices = 0
    const monthlyRevenue = {}
    invoicesSnap.forEach(doc => {
      const inv = doc.data()
      totalInvoices++
      const amount = Number(inv.total) || 0
      if (inv.status === 'paid') {
        totalRevenue += amount
        const month = (inv.paymentDate || inv.issueDate || '').slice(0, 7)
        if (month) monthlyRevenue[month] = (monthlyRevenue[month] ?? 0) + amount
      } else if (inv.status !== 'cancelled') {
        pendingAmount += amount
      }
    })

    // Last 6 months revenue
    const now = new Date()
    const last6Months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    }).reverse()

    const revenueChart = last6Months.map(m => ({ month: m, revenue: monthlyRevenue[m] ?? 0 }))

    return Response.json({
      profile: {
        firstName:      profile.firstName      ?? '',
        lastName:       profile.lastName       ?? '',
        email:          profile.email          ?? '',
        clinicName:     profile.clinicName     ?? '',
        specialization: profile.specialization ?? '',
        phone:          profile.phone          ?? '',
        licenseNumber:  profile.licenseNumber  ?? '',
        subscription:   profile.subscription   ?? null,
        viewOnly:       profile.viewOnly       ?? false,
        createdAt:      profile.createdAt      ?? null,
        inviteCode:     profile.inviteCode     ?? '',
        organizationId: profile.organizationId ?? null,
        branchName:     profile.branchName     ?? '',
      },
      auth: authMeta,
      org: orgData,
      stats: {
        patientCount,
        totalInvoices,
        totalRevenue,
        pendingAmount,
        revenueChart,
        recentPatients: recentPatients.slice(0, 5),
      },
    })
  } catch (err) {
    console.error('[admin/clinic]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/admin/clinic — update subscription or access
export async function PATCH(request) {
  const caller = await verifyAdmin(request)
  if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { uid, subscription, viewOnly } = await request.json()
  if (!uid) return Response.json({ error: 'uid required' }, { status: 400 })

  const db = getAdminDb()
  const updates = {}
  if (subscription !== undefined) updates.subscription = subscription
  if (viewOnly     !== undefined) updates.viewOnly     = viewOnly

  await db.collection('users').doc(uid).collection('profile').doc('doctor').update(updates)
  return Response.json({ ok: true })
}
