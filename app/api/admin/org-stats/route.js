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

async function fetchBranchStats(db, uid) {
  const base = db.collection('users').doc(uid)
  const [invoiceSnap, patientSnap, expenseSnap, appointmentSnap] = await Promise.all([
    base.collection('invoices').get(),
    base.collection('patients').get(),
    base.collection('expenses').get(),
    base.collection('appointments').get(),
  ])

  let revenue = 0, pending = 0, overdue = 0
  invoiceSnap.docs.forEach(d => {
    const inv = d.data()
    const total = inv.total ?? 0
    if (inv.status === 'paid')                      revenue += total
    else if (inv.status === 'overdue')              overdue += total
    else if (['draft','sent'].includes(inv.status)) pending += total
  })

  let expenses = 0
  expenseSnap.docs.forEach(d => { expenses += d.data().amount ?? 0 })

  return {
    revenue,
    pending,
    overdue,
    expenses,
    patients:     patientSnap.size,
    appointments: appointmentSnap.size,
  }
}

// GET /api/admin/org-stats?orgId=xxx
export async function GET(request) {
  const caller = await verifyAdmin(request)
  if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const orgId = new URL(request.url).searchParams.get('orgId')
  if (!orgId) return Response.json({ error: 'orgId required' }, { status: 400 })

  const db      = getAdminDb()
  const orgSnap = await db.collection('organizations').doc(orgId).get()
  if (!orgSnap.exists) return Response.json({ error: 'Organization not found' }, { status: 404 })

  const orgData  = orgSnap.data()
  const branches = orgData.branches ?? []

  const results = await Promise.all(
    branches.map(async b => {
      const profileSnap = await db.collection('users').doc(b.uid).collection('profile').doc('doctor').get()
      const profile = profileSnap.data() ?? {}
      const stats   = await fetchBranchStats(db, b.uid)
      return {
        uid:        b.uid,
        branchName: b.branchName || profile.clinicName || 'Branch',
        logoUrl:    profile.logoUrl ?? '',
        ...stats,
      }
    })
  )

  const totals = results.reduce((acc, b) => {
    acc.revenue      += b.revenue
    acc.pending      += b.pending
    acc.overdue      += b.overdue
    acc.expenses     += b.expenses
    acc.patients     += b.patients
    acc.appointments += b.appointments
    return acc
  }, { revenue: 0, pending: 0, overdue: 0, expenses: 0, patients: 0, appointments: 0 })

  return Response.json({ totals, branches: results })
}
