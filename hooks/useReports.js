'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { dataStore } from '@/lib/dataStore'
import { useAuth } from '@/context/AuthContext'

// ─── Inline stat computation from live data ──────────────────────────────────

function computeStats({ patients, appointments, invoices, followups, visits }) {
  const now      = new Date()
  const today    = now.toISOString().slice(0, 10)
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
  const twoDays  = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10)

  // Patients
  const patientStats = {
    total:     patients.length,
    active:    patients.filter(p => p.status === 'active').length,
    thisMonth: patients.filter(p => {
      const d = new Date(p.createdAt)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    }).length,
  }

  // Appointments
  const apptStats = {
    total:          appointments.length,
    todayCount:     appointments.filter(a => a.date === today).length,
    completedCount: appointments.filter(a => a.status === 'completed').length,
    noShowCount:    appointments.filter(a => a.status === 'no_show').length,
    upcomingCount:  appointments.filter(a => a.date >= today && a.status === 'scheduled').length,
  }

  // Billing
  const paid    = invoices.filter(i => i.status === 'paid')
  const pending = invoices.filter(i => ['draft', 'sent'].includes(i.status))
  const overdue = invoices.filter(i => i.status === 'overdue')
  const billingStats = {
    total:         invoices.length,
    paid:          paid.length,
    pending:       pending.length,
    overdue:       overdue.length,
    totalRevenue:  paid.reduce((s, i) => s + i.total, 0),
    pendingAmount: pending.reduce((s, i) => s + i.total, 0),
    todayRevenue:  paid.filter(i => i.issueDate === today).reduce((s, i) => s + i.total, 0),
  }

  // Visits
  const sortedVisits = [...visits].sort((a, b) => new Date(b.visitDate) - new Date(a.visitDate))
  const visitStats = {
    todayCount:       visits.filter(v => v.visitDate === today).length,
    followupToday:    visits.filter(v => v.followUpDate === today).length,
    followupTomorrow: visits.filter(v => v.followUpDate === tomorrow).length,
    recent:           sortedVisits.slice(0, 5),
  }

  // Follow-ups — merge standalone (pending) + visit-based followUpDates
  const pendingFU = followups.filter(f => f.status === 'pending')
  const visitFUDates = visits.filter(v => v.followUpDate).map(v => v.followUpDate)
  const allDates = [...pendingFU.map(f => f.dueDate), ...visitFUDates]
  const followupStats = {
    todayCount:    allDates.filter(d => d === today).length,
    tomorrowCount: allDates.filter(d => d === tomorrow).length,
    twoDaysCount:  allDates.filter(d => d === twoDays).length,
    overdueCount:  allDates.filter(d => d < today).length,
    upcomingCount: allDates.filter(d => d > tomorrow).length,
    total:         allDates.length,
  }

  return { patients: patientStats, appointments: apptStats, billing: billingStats, visits: visitStats, followups: followupStats }
}

function computeMonthlyRevenue(invoices, months = 6) {
  const now = new Date()
  return Array.from({ length: months }, (_, i) => {
    const d      = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1)
    const label  = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
    const prefix = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const revenue = invoices
      .filter(inv => inv.status === 'paid' && inv.issueDate?.startsWith(prefix))
      .reduce((s, inv) => s + inv.total, 0)
    return { label, revenue }
  })
}

function computePatientGrowth(patients, months = 6) {
  const now = new Date()
  return Array.from({ length: months }, (_, i) => {
    const d      = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1)
    const label  = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
    const prefix = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const count  = patients.filter(p => p.createdAt?.startsWith(prefix)).length
    return { label, count }
  })
}

function computeReferralBreakdown(patients) {
  const LABELS = {
    walk_in: 'Walk-in', first_visit: 'First Visit', patient_referral: 'Patient Referral',
    doctor_referral: 'Doctor Referral', social_media: 'Social Media',
    advertisement: 'Advertisement', returning: 'Returning', other: 'Other', '': 'Unknown',
  }
  const counts = {}
  patients.forEach(p => {
    const key = p.referralSource || ''
    counts[key] = (counts[key] ?? 0) + 1
  })
  return Object.entries(counts)
    .map(([key, count]) => ({ key, label: LABELS[key] ?? key, count }))
    .sort((a, b) => b.count - a.count)
}

export function computeRevenueForRange(invoices, from, to) {
  return invoices
    .filter(inv => inv.status === 'paid' && inv.issueDate >= from && inv.issueDate <= to)
    .reduce((s, inv) => s + inv.total, 0)
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useReports() {
  const { doctor } = useAuth()
  const [stats,             setStats]    = useState(null)
  const [monthlyRevenue,    setMonthly]  = useState([])
  const [yearlyRevenue,     setYearly]   = useState([])
  const [patientGrowth,     setGrowth]   = useState([])
  const [referralBreakdown, setReferral] = useState([])
  const [rawInvoices,       setRawInvoices]     = useState([])
  const [rawPatients,       setRawPatients]     = useState([])
  const [rawAppointments,   setRawAppointments] = useState([])
  const [rawVisits,         setRawVisits]       = useState([])
  const [loading,           setLoading]         = useState(true)

  // Stable ref holds the latest snapshot from each listener
  const live = useRef({ patients: [], appointments: [], invoices: [], followups: [], visits: [] })
  // Track how many listeners have fired at least once
  const ready = useRef({ patients: false, appointments: false, invoices: false, followups: false, visits: false })

  const recompute = useCallback((collection, docs) => {
    live.current[collection] = docs
    ready.current[collection] = true
    // Only emit stats once every collection has delivered its first snapshot
    if (Object.values(ready.current).every(Boolean)) {
      const d = live.current
      setStats(computeStats(d))
      setMonthly(computeMonthlyRevenue(d.invoices, 6))
      setYearly(computeMonthlyRevenue(d.invoices, 12))
      setGrowth(computePatientGrowth(d.patients))
      setReferral(computeReferralBreakdown(d.patients))
      setRawInvoices(d.invoices)
      setRawPatients(d.patients)
      setRawAppointments(d.appointments)
      setRawVisits(d.visits)
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!doctor) return

    setLoading(true)
    // Reset readiness so a doctor change triggers a fresh load
    ready.current = { patients: false, appointments: false, invoices: false, followups: false, visits: false }
    live.current  = { patients: [], appointments: [], invoices: [], followups: [], visits: [] }

    // visits uses getAllGroup (one-time fetch) — subscribeGroup requires a
    // Firestore composite index that may not exist; this avoids that requirement.
    dataStore.getAllGroup('visits').then(d => recompute('visits', d)).catch(() => recompute('visits', []))

    const unsubs = [
      dataStore.subscribe('patients',     d => recompute('patients',     d)),
      dataStore.subscribe('appointments', d => recompute('appointments', d)),
      dataStore.subscribe('invoices',     d => recompute('invoices',     d)),
      dataStore.subscribe('followups',    d => recompute('followups',    d)),
    ]

    return () => unsubs.forEach(u => u())
  }, [doctor, recompute])

  return { stats, monthlyRevenue, yearlyRevenue, patientGrowth, referralBreakdown, rawInvoices, rawPatients, rawAppointments, rawVisits, loading }
}
