'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { dataStore } from '@/lib/dataStore'
import { visitService } from '@/services/visitService'
import { useAuth } from '@/context/AuthContext'
import { getReferralSources, buildLabelMap } from '@/lib/referralSources'

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

  // Visits — exclude drafts, they aren't real completed visits yet
  const completedVisits = visits.filter(v => v.status !== 'draft')
  const sortedVisits = [...completedVisits].sort((a, b) => new Date(b.visitDate) - new Date(a.visitDate))
  const visitStats = {
    todayCount:       completedVisits.filter(v => v.visitDate?.slice(0, 10) === today).length,
    followupToday:    completedVisits.filter(v => v.followUpDate === today).length,
    followupTomorrow: completedVisits.filter(v => v.followUpDate === tomorrow).length,
    recent:           sortedVisits.slice(0, 5),
  }

  // Follow-ups — the `followups` collection is the single source of truth:
  // visitService already creates/syncs a linked followup record whenever a
  // visit's followUpDate is set, and markDone() flips its status there. Pulling
  // followUpDate straight off visit records too (as this used to) double-counted
  // pending ones and, worse, never excluded follow-ups already marked done —
  // since visits are never retroactively cleared — so every past follow-up
  // date on any visit stayed "overdue" forever.
  const pendingFU = followups.filter(f => f.status === 'pending')
  const allDates = pendingFU.map(f => f.dueDate)
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

function computeReferralBreakdown(patients, customSources) {
  const LABELS = buildLabelMap(getReferralSources(customSources))
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
  const [rawFollowups,      setRawFollowups]    = useState([])
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
      setReferral(computeReferralBreakdown(d.patients, doctor?.referralSources))
      setRawInvoices(d.invoices)
      setRawPatients(d.patients)
      setRawAppointments(d.appointments)
      setRawVisits(d.visits)
      setRawFollowups(d.followups)
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!doctor) return

    setLoading(true)
    // Reset readiness so a doctor change triggers a fresh load
    ready.current = { patients: false, appointments: false, invoices: false, followups: false, visits: false }
    live.current  = { patients: [], appointments: [], invoices: [], followups: [], visits: [] }

    // One-time fetches, not live subscriptions — several of these stats (total
    // revenue, total patients, overdue follow-ups) are genuine all-time totals
    // that can't be date-windowed without becoming wrong, so the collections
    // have to be read in full. Keeping them live would mean re-reading each
    // one whenever *anyone* in the clinic writes to it, for as long as this
    // tab stays open — reading once per visit instead bounds the cost to that
    // visit. Stats refresh again next time the page is opened/navigated to.
    const load = (collection) =>
      dataStore.getAll(collection).then(d => recompute(collection, d)).catch(err => {
        console.error(`Failed to load ${collection} for reports:`, err)
        recompute(collection, [])
      })

    visitService.getAll().then(d => recompute('visits', d)).catch(err => {
      console.error('Failed to load visits for reports:', err)
      recompute('visits', [])
    })
    load('patients')
    load('appointments')
    load('invoices')
    load('followups')
  }, [doctor, recompute])

  return { stats, monthlyRevenue, yearlyRevenue, patientGrowth, referralBreakdown, rawInvoices, rawPatients, rawAppointments, rawVisits, rawFollowups, loading }
}
