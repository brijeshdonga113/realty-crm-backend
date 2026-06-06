'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layout/AppLayout'
import { useAuth } from '@/context/AuthContext'
import { auth } from '@/lib/firebase'

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(isoStr) {
  if (!isoStr) return null
  const diff = Date.now() - new Date(isoStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)   return 'just now'
  if (m < 60)  return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24)  return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30)  return `${d}d ago`
  const mo = Math.floor(d / 30)
  if (mo < 12) return `${mo}mo ago`
  return `${Math.floor(mo / 12)}y ago`
}

function fmtDate(isoStr) {
  if (!isoStr) return '—'
  return new Date(isoStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

async function adminFetch(path, opts = {}) {
  const token = await auth.currentUser?.getIdToken() ?? null
  return fetch(path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(opts.headers ?? {}) },
  })
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SubBadge({ sub }) {
  if (!sub?.status) return <span className="text-xs text-gray-400 dark:text-gray-500">—</span>
  const cfg = {
    active:  'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
    trial:   'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
    expired: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  }
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${cfg[sub.status] ?? 'bg-gray-100 text-gray-600'}`}>
      {sub.status}
    </span>
  )
}

function LoginCell({ isoStr }) {
  if (!isoStr) return <span className="text-xs text-gray-400 dark:text-gray-500">Never</span>
  const diff = Date.now() - new Date(isoStr).getTime()
  const days = diff / 86400000
  const color = days < 1 ? 'text-green-600 dark:text-green-400'
    : days < 7  ? 'text-blue-600 dark:text-blue-400'
    : days < 30 ? 'text-gray-700 dark:text-gray-300'
    : 'text-red-500 dark:text-red-400'
  return (
    <div>
      <p className={`text-xs font-semibold ${color}`}>{timeAgo(isoStr)}</p>
      <p className="text-xs text-gray-400 dark:text-gray-500">{fmtDate(isoStr)}</p>
    </div>
  )
}

function StatCard({ label, value, color }) {
  const cfg = {
    primary: 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 border-primary-100 dark:border-primary-800',
    green:   'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800',
    blue:    'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800',
    red:     'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800',
    yellow:  'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-100 dark:border-yellow-800',
  }
  return (
    <div className={`rounded-xl border p-4 ${cfg[color]}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{label}</p>
    </div>
  )
}

// ── Create Clinic Modal ───────────────────────────────────────────────────────

const SPECIALIZATIONS = [
  { value: '',              label: 'Select specialization…' },
  { value: 'general',       label: 'General Practitioner' },
  { value: 'cardiology',    label: 'Cardiology' },
  { value: 'dermatology',   label: 'Dermatology' },
  { value: 'neurology',     label: 'Neurology' },
  { value: 'orthopedics',   label: 'Orthopedics' },
  { value: 'pediatrics',    label: 'Pediatrics' },
  { value: 'psychiatry',    label: 'Psychiatry' },
  { value: 'gynecology',    label: 'Gynecology & Obstetrics' },
  { value: 'ophthalmology', label: 'Ophthalmology' },
  { value: 'ent',           label: 'ENT' },
  { value: 'dentistry',     label: 'Dentistry' },
  { value: 'homeopathy',    label: 'Homeopathy' },
  { value: 'ayurveda',      label: 'Ayurveda' },
  { value: 'other',         label: 'Other' },
]

const BLANK = { firstName: '', lastName: '', email: '', clinicName: '', specialization: '', phone: '', password: '' }

function CreateClinicModal({ open, onClose, onCreated }) {
  const [form,    setForm]    = useState(BLANK)
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)
  const [done,    setDone]    = useState(null)

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setError('') }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const res  = await adminFetch('/api/admin/create-doctor', { method: 'POST', body: JSON.stringify(form) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setDone({ email: form.email, password: form.password })
      onCreated?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setForm(BLANK); setError(''); setDone(null)
    onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
          <h2 className="text-base font-bold text-gray-900 dark:text-white">Add New Clinic</h2>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 rounded-lg transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {done ? (
          <div className="p-6 space-y-4">
            <div className="flex items-start gap-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-xl p-4">
              <svg className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
              </svg>
              <div>
                <p className="text-sm font-bold text-green-800 dark:text-green-300">Clinic account created</p>
                <p className="text-xs text-green-700 dark:text-green-400 mt-1">Share these login credentials with the doctor.</p>
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 space-y-2">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Email</p>
                <p className="text-sm font-mono text-gray-800 dark:text-gray-200 mt-0.5">{done.email}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Temporary Password</p>
                <p className="text-sm font-mono text-gray-800 dark:text-gray-200 mt-0.5 select-all">{done.password}</p>
              </div>
            </div>
            <p className="text-xs text-amber-600 dark:text-amber-400">Ask them to change their password after first login from Settings.</p>
            <button onClick={handleClose}
              className="w-full px-4 py-2.5 bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold rounded-xl transition-colors">
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">First Name *</label>
                <input value={form.firstName} onChange={e => set('firstName', e.target.value)} required className="input-field"/>
              </div>
              <div>
                <label className="form-label">Last Name *</label>
                <input value={form.lastName} onChange={e => set('lastName', e.target.value)} required className="input-field"/>
              </div>
            </div>
            <div>
              <label className="form-label">Email *</label>
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)} required className="input-field"/>
            </div>
            <div>
              <label className="form-label">Clinic Name</label>
              <input value={form.clinicName} onChange={e => set('clinicName', e.target.value)} className="input-field"/>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">Specialization</label>
                <select value={form.specialization} onChange={e => set('specialization', e.target.value)} className="input-field">
                  {SPECIALIZATIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Phone</label>
                <input value={form.phone} onChange={e => set('phone', e.target.value)} className="input-field"/>
              </div>
            </div>
            <div>
              <label className="form-label">Temporary Password *</label>
              <input type="text" value={form.password} onChange={e => set('password', e.target.value)}
                required minLength={6} placeholder="Min 6 characters" className="input-field font-mono"/>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">The doctor should change this after first login.</p>
            </div>
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={handleClose}
                className="flex-1 px-4 py-2 border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={loading}
                className="flex-1 px-4 py-2 bg-primary-500 hover:bg-primary-600 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2">
                {loading && <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
                {loading ? 'Creating…' : 'Create Clinic'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

// ── Clinic Profile Drawer ─────────────────────────────────────────────────────

const PLAN_STATUSES = [
  { value: 'trial',   label: 'Trial',   color: 'blue'  },
  { value: 'active',  label: 'Active',  color: 'green' },
  { value: 'expired', label: 'Expired', color: 'red'   },
]

function fmt(n) { return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n) }

function ClinicDrawer({ uid, onClose, onUpdated }) {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [err,     setErr]     = useState('')
  const [tab,     setTab]     = useState('overview')

  // Plan edit
  const [editPlan,    setEditPlan]    = useState(false)
  const [planStatus,  setPlanStatus]  = useState('')
  const [planExpiry,  setPlanExpiry]  = useState('')
  const [planSaving,  setPlanSaving]  = useState(false)

  useEffect(() => {
    if (!uid) return
    setLoading(true); setErr('')
    adminFetch(`/api/admin/clinic?uid=${uid}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error)
        setData(d)
        setPlanStatus(d.profile.subscription?.status ?? 'trial')
        setPlanExpiry(d.profile.subscription?.expiresAt?.slice(0, 10) ?? d.profile.subscription?.trialEndsAt?.slice(0, 10) ?? '')
      })
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false))
  }, [uid])

  const handlePlanSave = async () => {
    setPlanSaving(true)
    try {
      const subscription = {
        ...(data.profile.subscription ?? {}),
        status: planStatus,
        ...(planExpiry ? { expiresAt: planExpiry, trialEndsAt: planExpiry } : {}),
      }
      await adminFetch('/api/admin/clinic', {
        method: 'PATCH',
        body: JSON.stringify({ uid, subscription }),
      })
      setData(prev => ({ ...prev, profile: { ...prev.profile, subscription } }))
      setEditPlan(false)
      onUpdated?.()
    } finally {
      setPlanSaving(false)
    }
  }

  const handleAccessToggle = async () => {
    const next = !data.profile.viewOnly
    await adminFetch('/api/admin/clinic', { method: 'PATCH', body: JSON.stringify({ uid, viewOnly: next }) })
    setData(prev => ({ ...prev, profile: { ...prev.profile, viewOnly: next } }))
    onUpdated?.()
  }

  if (!uid) return null

  const sub = data?.profile?.subscription
  const subColor = sub?.status === 'active' ? 'green' : sub?.status === 'trial' ? 'blue' : 'red'
  const subLabel = PLAN_STATUSES.find(p => p.value === sub?.status)?.label ?? sub?.status ?? '—'
  const expiryDate = sub?.expiresAt || sub?.trialEndsAt
  const isExpired  = expiryDate && new Date(expiryDate) < new Date()
  const daysLeft   = expiryDate ? Math.ceil((new Date(expiryDate) - new Date()) / 86400000) : null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose}/>

      {/* Drawer */}
      <div className="relative w-full max-w-2xl bg-white dark:bg-gray-900 h-full flex flex-col shadow-2xl overflow-hidden">

        {/* Header */}
        {loading ? (
          <div className="flex items-center justify-center flex-1 text-gray-400 gap-3 text-sm">
            <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            Loading clinic data…
          </div>
        ) : err ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-red-500 dark:text-red-400">{err}</p>
          </div>
        ) : data && (
          <>
            {/* Top bar */}
            <div className="flex items-start gap-4 px-6 py-5 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
              <div className="w-12 h-12 rounded-xl bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center flex-shrink-0 text-lg font-bold text-primary-700 dark:text-primary-300">
                {(data.profile.firstName?.[0] ?? '').toUpperCase()}{(data.profile.lastName?.[0] ?? '').toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white truncate">
                  {data.profile.clinicName || `Dr. ${data.profile.firstName} ${data.profile.lastName}`}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Dr. {data.profile.firstName} {data.profile.lastName} · {data.profile.specialization?.replace(/_/g,' ') || 'General'}
                </p>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    subColor === 'green' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                    : subColor === 'blue' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                  }`}>{subLabel}</span>
                  {data.profile.viewOnly && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">View Only</span>
                  )}
                  {data.auth.emailVerified && (
                    <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-0.5">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
                      Verified
                    </span>
                  )}
                </div>
              </div>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1.5 rounded-lg transition-colors flex-shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>

            {/* Sub-tabs */}
            <div className="flex gap-1 px-6 pt-4 pb-0 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
              {['overview', 'financials', 'patients'].map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={`px-4 py-2 text-sm font-semibold capitalize border-b-2 transition-colors -mb-px ${
                    tab === t
                      ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}>
                  {t}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">

              {/* ── Overview ── */}
              {tab === 'overview' && (
                <>
                  {/* Plan card */}
                  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-gray-900 dark:text-white text-sm">Subscription Plan</h4>
                      {!editPlan && (
                        <button onClick={() => setEditPlan(true)}
                          className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline">
                          Edit
                        </button>
                      )}
                    </div>

                    {editPlan ? (
                      <div className="space-y-3">
                        <div>
                          <label className="form-label">Status</label>
                          <div className="flex gap-2 mt-1">
                            {PLAN_STATUSES.map(p => (
                              <button key={p.value} type="button" onClick={() => setPlanStatus(p.value)}
                                className={`flex-1 py-2 text-sm font-semibold rounded-lg border transition-colors ${
                                  planStatus === p.value
                                    ? 'bg-primary-500 text-white border-primary-500'
                                    : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600'
                                }`}>{p.label}</button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="form-label">Expiry / Trial End Date</label>
                          <input type="date" value={planExpiry} onChange={e => setPlanExpiry(e.target.value)} className="input-field"/>
                        </div>
                        <div className="flex gap-2 pt-1">
                          <button onClick={() => setEditPlan(false)}
                            className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                            Cancel
                          </button>
                          <button onClick={handlePlanSave} disabled={planSaving}
                            className="flex-1 px-3 py-2 bg-primary-500 hover:bg-primary-600 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors">
                            {planSaving ? 'Saving…' : 'Save Plan'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide font-semibold mb-1">Status</p>
                          <span className={`text-sm font-bold capitalize ${
                            subColor === 'green' ? 'text-green-600 dark:text-green-400'
                            : subColor === 'blue' ? 'text-blue-600 dark:text-blue-400'
                            : 'text-red-600 dark:text-red-400'
                          }`}>{subLabel}</span>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide font-semibold mb-1">
                            {sub?.status === 'trial' ? 'Trial Ends' : 'Expires'}
                          </p>
                          {expiryDate ? (
                            <div>
                              <p className={`text-sm font-semibold ${isExpired ? 'text-red-600 dark:text-red-400' : 'text-gray-800 dark:text-gray-200'}`}>
                                {fmtDate(expiryDate)}
                              </p>
                              <p className={`text-xs ${isExpired ? 'text-red-500' : daysLeft <= 7 ? 'text-amber-500' : 'text-gray-400 dark:text-gray-500'}`}>
                                {isExpired ? 'Expired' : `${daysLeft}d remaining`}
                              </p>
                            </div>
                          ) : <p className="text-sm text-gray-400">—</p>}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Access control */}
                  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold text-gray-900 dark:text-white text-sm">Access Control</h4>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                          {data.profile.viewOnly ? 'This clinic is currently in view-only mode — no create/edit actions.' : 'This clinic has full access to all features.'}
                        </p>
                      </div>
                      <button onClick={handleAccessToggle}
                        className={`px-4 py-2 text-sm font-semibold rounded-lg border transition-colors ${
                          data.profile.viewOnly
                            ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700 text-green-700 dark:text-green-400 hover:bg-green-100'
                            : 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 hover:bg-amber-100'
                        }`}>
                        {data.profile.viewOnly ? 'Restore Full Access' : 'Restrict to View Only'}
                      </button>
                    </div>
                  </div>

                  {/* Organization / Group info */}
                  {data.org && (
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5">
                      <div className="flex items-center gap-2 mb-4">
                        <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
                        </svg>
                        <h4 className="font-semibold text-gray-900 dark:text-white text-sm">{data.org.name}</h4>
                        <span className="text-xs bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-full font-medium">
                          {data.profile.branchName || 'Branch'}
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide font-semibold mb-2">All Branches</p>
                        {(data.org.branches ?? []).map(b => (
                          <div key={b.uid} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg ${b.uid === uid ? 'bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800' : 'bg-gray-50 dark:bg-gray-700/40'}`}>
                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${b.uid === uid ? 'bg-primary-500' : 'bg-gray-400 dark:bg-gray-500'}`}/>
                            <p className={`text-xs font-semibold flex-1 ${b.uid === uid ? 'text-primary-700 dark:text-primary-300' : 'text-gray-700 dark:text-gray-300'}`}>
                              {b.branchName}
                            </p>
                            {b.uid === uid && <span className="text-xs text-primary-500 dark:text-primary-400">This clinic</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Clinic info */}
                  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5">
                    <h4 className="font-semibold text-gray-900 dark:text-white text-sm mb-4">Clinic Details</h4>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                      {[
                        { label: 'Email',           value: data.profile.email },
                        { label: 'Phone',           value: data.profile.phone || '—' },
                        { label: 'License No.',     value: data.profile.licenseNumber || '—' },
                        { label: 'Email Verified',  value: data.auth.emailVerified ? 'Yes ✓' : 'No' },
                        { label: 'Joined',          value: fmtDate(data.profile.createdAt) },
                        { label: 'Last Login',      value: data.auth.lastSignInTime ? `${timeAgo(data.auth.lastSignInTime)} (${fmtDate(data.auth.lastSignInTime)})` : 'Never' },
                      ].map(({ label, value }) => (
                        <div key={label}>
                          <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide font-semibold">{label}</p>
                          <p className="text-gray-800 dark:text-gray-200 mt-0.5 text-sm truncate">{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* ── Financials ── */}
              {tab === 'financials' && (
                <>
                  {/* Summary cards */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Total Revenue', value: fmt(data.stats.totalRevenue), color: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800' },
                      { label: 'Pending',       value: fmt(data.stats.pendingAmount), color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800' },
                      { label: 'Total Invoices', value: data.stats.totalInvoices, color: 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 border-primary-100 dark:border-primary-800' },
                    ].map(c => (
                      <div key={c.label} className={`rounded-xl border p-4 ${c.color}`}>
                        <p className="text-lg font-bold">{c.value}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{c.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Monthly revenue chart (bar) */}
                  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5">
                    <h4 className="font-semibold text-gray-900 dark:text-white text-sm mb-4">Monthly Revenue (Last 6 Months)</h4>
                    {data.stats.revenueChart.every(m => m.revenue === 0) ? (
                      <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">No revenue recorded yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {(() => {
                          const max = Math.max(...data.stats.revenueChart.map(m => m.revenue), 1)
                          return data.stats.revenueChart.map(m => {
                            const pct = Math.round((m.revenue / max) * 100)
                            const [y, mo] = m.month.split('-')
                            const label = new Date(Number(y), Number(mo) - 1).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
                            return (
                              <div key={m.month} className="flex items-center gap-3">
                                <p className="text-xs text-gray-400 w-14 flex-shrink-0">{label}</p>
                                <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                                  <div className="bg-primary-500 h-2 rounded-full transition-all" style={{ width: `${pct}%` }}/>
                                </div>
                                <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 w-20 text-right">{fmt(m.revenue)}</p>
                              </div>
                            )
                          })
                        })()}
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* ── Patients ── */}
              {tab === 'patients' && (
                <>
                  <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800 rounded-xl p-5 flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary-500 rounded-xl flex items-center justify-center flex-shrink-0">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
                      </svg>
                    </div>
                    <div>
                      <p className="text-3xl font-bold text-primary-700 dark:text-primary-300">{data.stats.patientCount}</p>
                      <p className="text-sm text-primary-600 dark:text-primary-400">Total Registered Patients</p>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5">
                    <h4 className="font-semibold text-gray-900 dark:text-white text-sm mb-4">Recently Added Patients</h4>
                    {data.stats.recentPatients.length === 0 ? (
                      <p className="text-sm text-gray-400 dark:text-gray-500 py-4 text-center">No patients yet.</p>
                    ) : (
                      <div className="space-y-3">
                        {data.stats.recentPatients.map(p => (
                          <div key={p.id} className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center flex-shrink-0 text-xs font-bold text-primary-700 dark:text-primary-300">
                              {(p.firstName?.[0] ?? '').toUpperCase()}{(p.lastName?.[0] ?? '').toUpperCase()}
                            </div>
                            <p className="text-sm font-medium text-gray-800 dark:text-gray-200 flex-1">{p.firstName} {p.lastName}</p>
                            <p className="text-xs text-gray-400 dark:text-gray-500">{fmtDate(p.createdAt)}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}

            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const { doctor, updateProfile, loading: authLoading } = useAuth()
  const router = useRouter()

  const [tab,           setTab]          = useState('dashboard')
  const [enriched,      setEnriched]     = useState([])
  const [loading,       setLoading]      = useState(true)
  const [apiError,      setApiError]     = useState('')
  const [search,        setSearch]       = useState('')
  const [sort,          setSort]         = useState({ key: 'createdAt', dir: -1 })
  const [showCreate,    setShowCreate]   = useState(false)
  const [selectedClinic, setSelectedClinic] = useState(null)
  // Organizations state
  const [orgs,          setOrgs]         = useState([])
  const [orgsLoading,   setOrgsLoading]  = useState(false)
  const [showOrgForm,   setShowOrgForm]  = useState(false)
  const [orgForm,       setOrgForm]      = useState({ name: '', branches: [] })
  const [orgSaving,     setOrgSaving]    = useState(false)
  const [orgErr,        setOrgErr]       = useState('')
  const [editOrg,       setEditOrg]      = useState(null) // org being edited

  // Profile tab state
  const [profileForm,    setProfileForm]    = useState({ firstName: '', lastName: '', email: '' })
  const [profileSaving,  setProfileSaving]  = useState(false)
  const [profileSaved,   setProfileSaved]   = useState(false)
  const [profileErr,     setProfileErr]     = useState('')
  const [pwForm,         setPwForm]         = useState({ current: '', next: '', confirm: '' })
  const [pwSaving,       setPwSaving]       = useState(false)
  const [pwErr,          setPwErr]          = useState('')
  const [pwDone,         setPwDone]         = useState(false)

  const fetchDoctors = async () => {
    try {
      const res  = await adminFetch('/api/admin/doctors')
      if (!res.ok) throw new Error(`API error ${res.status}`)
      const data = await res.json()
      setEnriched(data.doctors ?? [])
    } catch (err) {
      setApiError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchOrgs = async () => {
    setOrgsLoading(true)
    try {
      const res  = await adminFetch('/api/admin/organizations')
      const data = await res.json()
      setOrgs(data.orgs ?? [])
    } finally {
      setOrgsLoading(false)
    }
  }

  useEffect(() => {
    if (authLoading || !doctor?.isAdmin) return
    fetchDoctors()
    fetchOrgs()
    setProfileForm({ firstName: doctor.firstName ?? '', lastName: doctor.lastName ?? '', email: doctor.email ?? '' })
  }, [doctor, authLoading])

  const handleProfileSave = async (e) => {
    e.preventDefault()
    setProfileSaving(true); setProfileErr(''); setProfileSaved(false)
    try {
      await updateProfile({ firstName: profileForm.firstName.trim(), lastName: profileForm.lastName.trim() })
      setProfileSaved(true)
      setTimeout(() => setProfileSaved(false), 3000)
    } catch (err) {
      setProfileErr(err.message)
    } finally {
      setProfileSaving(false)
    }
  }

  const handlePasswordChange = async (e) => {
    e.preventDefault()
    if (pwForm.next.length < 8) { setPwErr('Password must be at least 8 characters.'); return }
    if (pwForm.next !== pwForm.confirm) { setPwErr('Passwords do not match.'); return }
    setPwSaving(true); setPwErr(''); setPwDone(false)
    try {
      const { EmailAuthProvider, reauthenticateWithCredential, updatePassword } = await import('firebase/auth')
      const user = auth.currentUser
      const cred = EmailAuthProvider.credential(user.email, pwForm.current)
      await reauthenticateWithCredential(user, cred)
      await updatePassword(user, pwForm.next)
      setPwDone(true)
      setPwForm({ current: '', next: '', confirm: '' })
      setTimeout(() => setPwDone(false), 4000)
    } catch (err) {
      const code = err.code
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') setPwErr('Current password is incorrect.')
      else setPwErr(err.message)
    } finally {
      setPwSaving(false)
    }
  }

  const toggleSort = (key) =>
    setSort(s => s.key === key ? { key, dir: -s.dir } : { key, dir: -1 })

  const stats = useMemo(() => ({
    total:      enriched.length,
    active:     enriched.filter(d => d.subscription?.status === 'active').length,
    trial:      enriched.filter(d => d.subscription?.status === 'trial').length,
    expired:    enriched.filter(d => d.subscription?.status === 'expired').length,
    todayLogin: enriched.filter(d => d.lastSignInTime && Date.now() - new Date(d.lastSignInTime).getTime() < 86400000).length,
  }), [enriched])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    let list = enriched.filter(d =>
      !q || `${d.firstName} ${d.lastName} ${d.clinicName} ${d.email} ${d.specialization}`.toLowerCase().includes(q)
    )
    return [...list].sort((a, b) => {
      const va = a[sort.key] ?? ''
      const vb = b[sort.key] ?? ''
      if (va < vb) return sort.dir
      if (va > vb) return -sort.dir
      return 0
    })
  }, [enriched, search, sort])

  if (doctor && !doctor.isAdmin) {
    return (
      <AppLayout title="Admin Panel">
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
          </div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Access Denied</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-sm mb-6">
            You need administrator privileges to access this panel.
          </p>
          <button onClick={() => router.push('/dashboard')}
            className="px-5 py-2 bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium rounded-lg transition-colors">
            Back to Dashboard
          </button>
        </div>
      </AppLayout>
    )
  }

  const SortIcon = ({ k }) => (
    <svg className={`inline w-3 h-3 ml-1 ${sort.key === k ? 'text-primary-500' : 'text-gray-300 dark:text-gray-600'} ${sort.key === k && sort.dir === 1 ? 'rotate-180' : ''} transition-transform`}
      fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
    </svg>
  )

  return (
    <AppLayout title="Admin Panel">

      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-700/60 rounded-xl mb-6 w-fit">
        {[
          { key: 'dashboard', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
          { key: 'profile',   label: 'Profile',   icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
              tab === t.key
                ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={t.icon}/>
            </svg>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Profile tab ───────────────────────────────────────────────────────── */}
      {tab === 'profile' && (
        <div className="max-w-lg space-y-6">

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-5">Admin Profile</h3>
            <form onSubmit={handleProfileSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">First Name</label>
                  <input value={profileForm.firstName} onChange={e => setProfileForm(f => ({ ...f, firstName: e.target.value }))}
                    className="input-field" required/>
                </div>
                <div>
                  <label className="form-label">Last Name</label>
                  <input value={profileForm.lastName} onChange={e => setProfileForm(f => ({ ...f, lastName: e.target.value }))}
                    className="input-field" required/>
                </div>
              </div>
              <div>
                <label className="form-label">Email</label>
                <input value={profileForm.email} disabled className="input-field opacity-60 cursor-not-allowed bg-gray-50 dark:bg-gray-700"/>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Email cannot be changed.</p>
              </div>
              {profileErr && <p className="text-sm text-red-600 dark:text-red-400">{profileErr}</p>}
              <button type="submit" disabled={profileSaving}
                className={`px-5 py-2 text-sm font-semibold rounded-lg transition-colors disabled:opacity-60 ${
                  profileSaved ? 'bg-green-500 text-white' : 'bg-primary-500 hover:bg-primary-600 text-white'
                }`}>
                {profileSaving ? 'Saving…' : profileSaved ? '✓ Saved' : 'Save Changes'}
              </button>
            </form>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-5">Change Password</h3>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <label className="form-label">Current Password</label>
                <input type="password" value={pwForm.current} onChange={e => setPwForm(f => ({ ...f, current: e.target.value }))}
                  required className="input-field" autoComplete="current-password"/>
              </div>
              <div>
                <label className="form-label">New Password</label>
                <input type="password" value={pwForm.next} onChange={e => setPwForm(f => ({ ...f, next: e.target.value }))}
                  required minLength={8} placeholder="Min. 8 characters" className="input-field" autoComplete="new-password"/>
              </div>
              <div>
                <label className="form-label">Confirm New Password</label>
                <input type="password" value={pwForm.confirm} onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))}
                  required className="input-field" autoComplete="new-password"/>
              </div>
              {pwErr  && <p className="text-sm text-red-600 dark:text-red-400">{pwErr}</p>}
              {pwDone && <p className="text-sm text-green-600 dark:text-green-400">Password updated successfully.</p>}
              <button type="submit" disabled={pwSaving}
                className="px-5 py-2 bg-primary-500 hover:bg-primary-600 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors">
                {pwSaving ? 'Updating…' : 'Update Password'}
              </button>
            </form>
          </div>

        </div>
      )}

      {/* ── Dashboard tab ─────────────────────────────────────────────────────── */}
      {tab === 'dashboard' && (
        <div className="space-y-6">

          <CreateClinicModal
            open={showCreate}
            onClose={() => setShowCreate(false)}
            onCreated={() => { setShowCreate(false); fetchDoctors() }}
          />

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <StatCard label="Registered Clinics" value={stats.total}      color="primary" />
            <StatCard label="Active"              value={stats.active}     color="green"   />
            <StatCard label="Trial"               value={stats.trial}      color="blue"    />
            <StatCard label="Expired"             value={stats.expired}    color="red"     />
            <StatCard label="Logged In Today"     value={stats.todayLogin} color="yellow"  />
          </div>

          {/* ── Organizations ── */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Organizations</h3>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Group clinics into multi-branch organizations</p>
              </div>
              <button onClick={() => { setOrgForm({ name: '', branches: [] }); setOrgErr(''); setEditOrg(null); setShowOrgForm(true) }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-500 hover:bg-primary-600 text-white text-xs font-semibold rounded-lg transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
                </svg>
                New Organization
              </button>
            </div>

            {/* Org form */}
            {showOrgForm && (
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-700/30 space-y-3">
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">
                  {editOrg ? 'Edit Organization' : 'New Organization'}
                </p>
                <div>
                  <label className="form-label">Organization Name *</label>
                  <input value={orgForm.name} onChange={e => setOrgForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Apollo Clinic Group" className="input-field"/>
                </div>
                <div>
                  <label className="form-label">Branch Clinics</label>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">Select the clinic accounts that form the branches of this organization.</p>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {enriched.map(d => {
                      const isSelected = orgForm.branches.some(b => b.uid === d.uid)
                      const branch = orgForm.branches.find(b => b.uid === d.uid)
                      return (
                        <div key={d.uid} className={`flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors ${isSelected ? 'border-primary-300 dark:border-primary-700 bg-primary-50 dark:bg-primary-900/20' : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800'}`}>
                          <input type="checkbox" checked={isSelected}
                            onChange={e => {
                              if (e.target.checked) {
                                setOrgForm(f => ({ ...f, branches: [...f.branches, { uid: d.uid, branchName: d.clinicName || `Dr. ${d.firstName} ${d.lastName}` }] }))
                              } else {
                                setOrgForm(f => ({ ...f, branches: f.branches.filter(b => b.uid !== d.uid) }))
                              }
                            }}
                            className="rounded text-primary-500"/>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">
                              {d.clinicName || `Dr. ${d.firstName} ${d.lastName}`}
                            </p>
                            <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{d.email}</p>
                          </div>
                          {isSelected && (
                            <input value={branch.branchName}
                              onChange={e => setOrgForm(f => ({ ...f, branches: f.branches.map(b => b.uid === d.uid ? { ...b, branchName: e.target.value } : b) }))}
                              placeholder="Branch name"
                              className="text-xs border border-primary-300 dark:border-primary-700 rounded-lg px-2 py-1 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 w-36 focus:outline-none focus:ring-1 focus:ring-primary-400"
                              onClick={e => e.stopPropagation()}/>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
                {orgErr && <p className="text-xs text-red-600 dark:text-red-400">{orgErr}</p>}
                <div className="flex gap-2 pt-1">
                  <button onClick={() => { setShowOrgForm(false); setEditOrg(null) }}
                    className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-600 text-xs font-medium text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    Cancel
                  </button>
                  <button disabled={orgSaving} onClick={async () => {
                    if (!orgForm.name.trim()) { setOrgErr('Name is required.'); return }
                    if (orgForm.branches.length < 1) { setOrgErr('Select at least one branch.'); return }
                    setOrgSaving(true); setOrgErr('')
                    try {
                      if (editOrg) {
                        await adminFetch('/api/admin/organizations', { method: 'PATCH', body: JSON.stringify({ id: editOrg.id, ...orgForm }) })
                      } else {
                        await adminFetch('/api/admin/organizations', { method: 'POST', body: JSON.stringify(orgForm) })
                      }
                      setShowOrgForm(false); setEditOrg(null)
                      fetchOrgs()
                    } catch (err) { setOrgErr(err.message) }
                    finally { setOrgSaving(false) }
                  }}
                    className="flex-1 px-3 py-2 bg-primary-500 hover:bg-primary-600 disabled:opacity-60 text-white text-xs font-semibold rounded-lg transition-colors">
                    {orgSaving ? 'Saving…' : editOrg ? 'Save Changes' : 'Create'}
                  </button>
                </div>
              </div>
            )}

            {/* Org list */}
            {orgsLoading ? (
              <div className="py-8 text-center text-sm text-gray-400">Loading…</div>
            ) : orgs.length === 0 && !showOrgForm ? (
              <div className="py-8 text-center text-sm text-gray-400 dark:text-gray-500">No organizations yet. Create one to link clinic branches.</div>
            ) : (
              <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
                {orgs.map(org => (
                  <div key={org.id} className="px-5 py-4 flex items-start gap-4">
                    <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{org.name}</p>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {(org.branches ?? []).map(b => (
                          <span key={b.uid} className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full">
                            {b.branchName}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button onClick={() => { setOrgForm({ name: org.name, branches: org.branches ?? [] }); setEditOrg(org); setShowOrgForm(true); setOrgErr('') }}
                        className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline">Edit</button>
                      <button onClick={async () => {
                        if (!window.confirm('Delete this organization? Branch clinics will be unlinked but their data stays intact.')) return
                        await adminFetch('/api/admin/organizations', { method: 'DELETE', body: JSON.stringify({ id: org.id }) })
                        fetchOrgs(); fetchDoctors()
                      }} className="text-xs font-medium text-red-500 dark:text-red-400 hover:underline">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Client list */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center gap-3">
              <h3 className="font-semibold text-gray-900 dark:text-white flex-1">
                All Registered Clients
                {!loading && <span className="ml-2 text-sm font-normal text-gray-400">({filtered.length})</span>}
              </h3>
              <div className="relative w-full sm:w-64">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                </svg>
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search clinic, doctor, email…"
                  className="w-full border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-xl pl-9 pr-8 py-2 text-sm focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 dark:focus:ring-primary-900/30 transition-all text-gray-900 dark:text-white placeholder-gray-400"/>
                {search && (
                  <button onClick={() => setSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                  </button>
                )}
              </div>
              <button onClick={() => setShowCreate(true)}
                className="flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold rounded-xl transition-colors whitespace-nowrap flex-shrink-0">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
                </svg>
                Add Clinic
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16 text-gray-400 gap-3 text-sm">
                <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Loading all registered clients…
              </div>
            ) : apiError ? (
              <div className="p-6 text-sm text-red-600 dark:text-red-400">{apiError}</div>
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center text-sm text-gray-400 dark:text-gray-500">
                {search ? `No clients matching "${search}"` : 'No clients registered yet.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px]">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/30">
                      {[
                        { key: 'clinicName',     label: 'Clinic'         },
                        { key: 'firstName',      label: 'Doctor'         },
                        { key: 'specialization', label: 'Specialization' },
                        { key: 'subscription',   label: 'Plan'           },
                        { key: 'createdAt',      label: 'Joined'         },
                        { key: 'lastSignInTime', label: 'Last Login'     },
                      ].map(col => (
                        <th key={col.label}
                          onClick={() => col.key && toggleSort(col.key)}
                          className={`px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide first:pl-5 last:pr-5 ${col.key ? 'cursor-pointer hover:text-primary-600 dark:hover:text-primary-400 select-none' : ''}`}>
                          {col.label}{col.key && <SortIcon k={col.key} />}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                    {filtered.map(d => {
                      const initials = `${d.firstName?.[0] ?? ''}${d.lastName?.[0] ?? ''}`.toUpperCase() || '?'
                      return (
                        <tr key={d.uid} onClick={() => setSelectedClinic(d.uid)}
                          className="hover:bg-gray-50/60 dark:hover:bg-gray-700/30 transition-colors cursor-pointer">

                          {/* Clinic */}
                          <td className="px-4 py-3.5 pl-5">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center flex-shrink-0 text-xs font-bold text-primary-700 dark:text-primary-300">
                                {initials}
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                  {d.clinicName || <span className="italic text-gray-400">No clinic name</span>}
                                </p>
                                {d.phone && <p className="text-xs text-gray-400 dark:text-gray-500">{d.phone}</p>}
                              </div>
                            </div>
                          </td>

                          {/* Doctor */}
                          <td className="px-4 py-3.5">
                            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                              Dr. {d.firstName} {d.lastName}
                            </p>
                          </td>

                          {/* Specialization */}
                          <td className="px-4 py-3.5">
                            <span className="text-xs text-gray-600 dark:text-gray-400 capitalize">
                              {d.specialization ? d.specialization.replace(/_/g, ' ') : '—'}
                            </span>
                          </td>

                          {/* Plan */}
                          <td className="px-4 py-3.5"><SubBadge sub={d.subscription} /></td>

                          {/* Joined */}
                          <td className="px-4 py-3.5">
                            <p className="text-xs text-gray-500 dark:text-gray-400">{fmtDate(d.createdAt)}</p>
                          </td>

                          {/* Last Login */}
                          <td className="px-4 py-3.5 pr-5"><LoginCell isoStr={d.lastSignInTime} /></td>

                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      )}

      {selectedClinic && (
        <ClinicDrawer
          uid={selectedClinic}
          onClose={() => setSelectedClinic(null)}
          onUpdated={() => fetchDoctors()}
        />
      )}

    </AppLayout>
  )
}
