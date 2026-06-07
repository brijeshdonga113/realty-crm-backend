import { getAdminDb, getAdminAuth } from '@/lib/firebaseAdmin'

async function verifyDoctor(request) {
  const idToken = (request.headers.get('Authorization') ?? '').replace('Bearer ', '').trim()
  if (!idToken) return null
  const adminAuth = await getAdminAuth()
  let decoded
  try { decoded = await adminAuth.verifyIdToken(idToken) } catch { return null }
  const db   = getAdminDb()
  const snap = await db.collection('users').doc(decoded.uid).collection('profile').doc('doctor').get()
  const data = snap.data()
  if (!data) return null
  return { uid: decoded.uid, ...data }
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
  const revenueByMonth = {}

  invoiceSnap.docs.forEach(d => {
    const inv = d.data()
    const total = inv.total ?? 0
    if (inv.status === 'paid') {
      revenue += total
      const month = (inv.paymentDate ?? inv.issueDate ?? '').slice(0, 7)
      if (month) revenueByMonth[month] = (revenueByMonth[month] ?? 0) + total
    } else if (inv.status === 'overdue') {
      overdue += total
    } else if (['draft', 'sent'].includes(inv.status)) {
      pending += total
    }
  })

  let expenses = 0
  expenseSnap.docs.forEach(d => { expenses += d.data().amount ?? 0 })

  const patients     = patientSnap.size
  const appointments = appointmentSnap.size
  const invoices     = invoiceSnap.size

  return { revenue, pending, overdue, expenses, patients, appointments, invoices, revenueByMonth }
}

export async function GET(request) {
  const caller = await verifyDoctor(request)
  if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (!caller.organizationId) return Response.json({ error: 'Not in an organization.' }, { status: 403 })

  const db      = getAdminDb()
  const orgSnap = await db.collection('organizations').doc(caller.organizationId).get()
  if (!orgSnap.exists) return Response.json({ error: 'Organization not found.' }, { status: 404 })

  const orgData  = orgSnap.data()
  const branches = orgData.branches ?? []

  // Fetch caller's own profile for branchName
  const branchList = branches.map(b => ({ uid: b.uid, branchName: b.branchName }))

  const results = await Promise.all(
    branchList.map(async b => {
      const profileSnap = await db.collection('users').doc(b.uid).collection('profile').doc('doctor').get()
      const profile     = profileSnap.data() ?? {}
      const stats       = await fetchBranchStats(db, b.uid)
      return {
        uid:        b.uid,
        branchName: b.branchName || profile.clinicName || 'Branch',
        clinicName: profile.clinicName ?? '',
        specialization: profile.specialization ?? '',
        ...stats,
      }
    })
  )

  // Aggregate totals
  const totals = results.reduce((acc, b) => {
    acc.revenue      += b.revenue
    acc.pending      += b.pending
    acc.overdue      += b.overdue
    acc.expenses     += b.expenses
    acc.patients     += b.patients
    acc.appointments += b.appointments
    acc.invoices     += b.invoices
    Object.entries(b.revenueByMonth).forEach(([m, v]) => {
      acc.revenueByMonth[m] = (acc.revenueByMonth[m] ?? 0) + v
    })
    return acc
  }, { revenue: 0, pending: 0, overdue: 0, expenses: 0, patients: 0, appointments: 0, invoices: 0, revenueByMonth: {} })

  return Response.json({
    org:     { id: caller.organizationId, name: orgData.name },
    totals,
    branches: results,
  })
}
