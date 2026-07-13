import { getAdminDb, getAdminAuth } from '@/lib/firebaseAdmin'
import { FieldValue } from 'firebase-admin/firestore'
import { createAdminClient } from '@/lib/supabase'

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

function invoiceStats(invoices) {
  let totalRevenue = 0, pendingAmount = 0, totalInvoices = 0
  const monthlyRevenue = {}
  invoices.forEach(inv => {
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
  const now = new Date()
  const last6Months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }).reverse()
  return {
    totalRevenue, pendingAmount, totalInvoices,
    revenueChart: last6Months.map(m => ({ month: m, revenue: monthlyRevenue[m] ?? 0 })),
  }
}

async function getSupabaseClinic(uid) {
  const supabaseAdmin = createAdminClient()
  const [{ data: profile }, { data: patientRows }, { data: invoiceRows }, { data: authData }] = await Promise.all([
    supabaseAdmin.from('doctors').select('*').eq('id', uid).maybeSingle(),
    supabaseAdmin.from('patients').select('id, data').eq('doctor_id', uid),
    supabaseAdmin.from('invoices').select('data').eq('doctor_id', uid),
    supabaseAdmin.auth.admin.getUserById(uid),
  ])
  if (!profile) return null

  const patients = patientRows ?? []
  const recentPatients = patients
    .map(p => ({ id: p.id, firstName: p.data.firstName ?? '', lastName: p.data.lastName ?? '', createdAt: p.data.createdAt ?? null }))
    .sort((a, b) => (b.createdAt ?? '') > (a.createdAt ?? '') ? 1 : -1)

  const u = authData?.user
  return Response.json({
    profile: {
      firstName: profile.first_name ?? '', lastName: profile.last_name ?? '', email: profile.email ?? '',
      clinicName: profile.clinic_name ?? '', specialization: profile.specialization ?? '', phone: profile.phone ?? '',
      licenseNumber: profile.license_number ?? '', subscription: profile.subscription ?? null,
      viewOnly: profile.view_only ?? false, createdAt: profile.created_at ?? null, inviteCode: profile.invite_code ?? '',
      organizationId: null, branchName: '', logoUrl: profile.logo_url ?? '',
      clinicRole: 'doctor', managedDoctors: [], managedBy: null,
      backend: 'SB',
    },
    managedDoctorProfiles: [],
    auth: u ? {
      lastSignInTime: u.last_sign_in_at ?? null, creationTime: u.created_at ?? null,
      emailVerified: !!u.email_confirmed_at, disabled: u.banned_until ? new Date(u.banned_until) > new Date() : false,
    } : {},
    org: null,
    stats: { patientCount: patients.length, recentPatients: recentPatients.slice(0, 5), ...invoiceStats((invoiceRows ?? []).map(r => r.data)) },
  })
}

// GET /api/admin/clinic?uid=xxx — full clinic overview
export async function GET(request) {
  const caller = await verifyAdmin(request)
  if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const uid = new URL(request.url).searchParams.get('uid')
  if (!uid) return Response.json({ error: 'uid required' }, { status: 400 })

  const db = getAdminDb()

  // uid's backend isn't in the request — check Supabase's registry first since
  // it's a single indexed lookup; fall through to Firestore's collection path.
  try {
    const sbResult = await getSupabaseClinic(uid)
    if (sbResult) return sbResult
  } catch (err) {
    console.error('[admin/clinic] Supabase lookup failed', err)
  }

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

    // Fetch managed doctor profiles if this is a clinic admin
    let managedDoctorProfiles = []
    if (profile.clinicRole === 'clinic_admin' && profile.managedDoctors?.length) {
      const snaps = await Promise.all(
        profile.managedDoctors.map(mUid =>
          db.collection('users').doc(mUid).collection('profile').doc('doctor').get()
        )
      )
      managedDoctorProfiles = snaps
        .filter(s => s.exists)
        .map(s => {
          const d = s.data()
          return {
            uid:            s.ref.parent.parent.id,
            firstName:      d.firstName      ?? '',
            lastName:       d.lastName       ?? '',
            clinicName:     d.clinicName     ?? '',
            specialization: d.specialization ?? '',
            logoUrl:        d.logoUrl        ?? '',
          }
        })
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
        logoUrl:        profile.logoUrl        ?? '',
        clinicRole:     profile.clinicRole     ?? 'doctor',
        managedDoctors: profile.managedDoctors ?? [],
        managedBy:      profile.managedBy      ?? null,
        backend:        'FB',
      },
      managedDoctorProfiles,
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

// PATCH /api/admin/clinic — update subscription, access, role, or managed doctors.
// Role/managed-doctor changes are FB-only (org/clinic-admin features are
// deferred for Supabase accounts, see plan) — subscription/viewOnly work for
// either backend since suspending a clinic is a core, always-needed action.
export async function PATCH(request) {
  const caller = await verifyAdmin(request)
  if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { uid, subscription, viewOnly, clinicRole, addManagedDoctor, removeManagedDoctor } = await request.json()
  if (!uid) return Response.json({ error: 'uid required' }, { status: 400 })

  const supabaseAdmin = createAdminClient()
  const { data: sbDoctor } = await supabaseAdmin.from('doctors').select('id').eq('id', uid).maybeSingle().catch(() => ({ data: null }))

  if (sbDoctor) {
    const updates = {}
    if (subscription !== undefined) updates.subscription = subscription
    if (viewOnly     !== undefined) updates.view_only    = viewOnly
    if (subscription?.status === 'expired') updates.view_only = true
    if (Object.keys(updates).length) await supabaseAdmin.from('doctors').update(updates).eq('id', uid)
    // clinicRole/managedDoctor changes are silently no-ops here — not wired
    // up for SB accounts yet.
    return Response.json({ ok: true })
  }

  const db = getAdminDb()
  const profileRef = db.collection('users').doc(uid).collection('profile').doc('doctor')

  // Basic field updates
  const updates = {}
  if (subscription !== undefined) updates.subscription = subscription
  if (viewOnly     !== undefined) updates.viewOnly     = viewOnly
  // Auto-enforce read-only when subscription is expired
  if (subscription?.status === 'expired') updates.viewOnly = true
  if (Object.keys(updates).length) await profileRef.update(updates)

  // Role change
  if (clinicRole !== undefined) {
    const currentSnap = await profileRef.get()
    const current = currentSnap.data() ?? {}

    if (clinicRole === 'clinic_admin' && current.clinicRole !== 'clinic_admin') {
      // Upgrading to clinic_admin — remove from any existing admin's list first
      if (current.managedBy) {
        await db.collection('users').doc(current.managedBy)
          .collection('profile').doc('doctor')
          .update({ managedDoctors: FieldValue.arrayRemove(uid) })
      }
      await profileRef.update({ clinicRole: 'clinic_admin', managedDoctors: [], managedBy: null })
    } else if (clinicRole === 'doctor' && current.clinicRole === 'clinic_admin') {
      // Downgrading from clinic_admin — clear managedBy on all linked doctors
      const linked = current.managedDoctors ?? []
      await Promise.all(linked.map(mUid =>
        db.collection('users').doc(mUid).collection('profile').doc('doctor')
          .update({ managedBy: null })
      ))
      await profileRef.update({ clinicRole: 'doctor', managedDoctors: null })
    }
  }

  // Add a doctor to this admin's managed list
  if (addManagedDoctor) {
    await profileRef.update({ managedDoctors: FieldValue.arrayUnion(addManagedDoctor) })
    await db.collection('users').doc(addManagedDoctor)
      .collection('profile').doc('doctor')
      .update({ managedBy: uid })
  }

  // Remove a doctor from this admin's managed list
  if (removeManagedDoctor) {
    await profileRef.update({ managedDoctors: FieldValue.arrayRemove(removeManagedDoctor) })
    await db.collection('users').doc(removeManagedDoctor)
      .collection('profile').doc('doctor')
      .update({ managedBy: null })
  }

  return Response.json({ ok: true })
}
