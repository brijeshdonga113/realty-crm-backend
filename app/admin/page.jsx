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

async function getToken() {
  return auth.currentUser?.getIdToken() ?? null
}

async function adminFetch(path, opts = {}) {
  const token = await getToken()
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

const BLANK_FORM      = { firstName: '', lastName: '', email: '', clinicName: '', specialization: '', phone: '', password: '' }
const BLANK_STAFF     = { name: '', email: '', password: '' }
const BLANK_RECEPTIONIST = { name: '', email: '', password: '', doctorId: '' }

// ── Manage Staff Modal ────────────────────────────────────────────────────────

function ManageStaffModal({ clinic, onClose }) {
  // clinic = { uid, clinicName, firstName, lastName }
  const [staff,    setStaff]    = useState(null)   // null = loading
  const [loadErr,  setLoadErr]  = useState('')
  const [form,     setForm]     = useState(BLANK_STAFF)
  const [showForm, setShowForm] = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [formErr,  setFormErr]  = useState('')
  const [done,     setDone]     = useState(null)   // { email, password } after create
  const [deleting, setDeleting] = useState({})

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setFormErr('') }

  const load = async () => {
    setLoadErr('')
    try {
      const res  = await adminFetch(`/api/admin/staff?doctorId=${clinic.uid}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setStaff(data.staff)
    } catch (err) {
      setLoadErr(err.message)
      setStaff([])
    }
  }

  useEffect(() => { load() }, [clinic.uid])

  const handleCreate = async (e) => {
    e.preventDefault()
    setSaving(true); setFormErr('')
    try {
      const res  = await adminFetch('/api/admin/staff', {
        method: 'POST',
        body:   JSON.stringify({ doctorId: clinic.uid, ...form }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setDone({ email: form.email, password: form.password })
      setForm(BLANK_STAFF)
      setShowForm(false)
      load()
    } catch (err) {
      setFormErr(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (uid) => {
    if (!window.confirm('Remove this receptionist account? They will no longer be able to log in.')) return
    setDeleting(d => ({ ...d, [uid]: true }))
    try {
      await adminFetch('/api/admin/staff', { method: 'DELETE', body: JSON.stringify({ uid }) })
      setStaff(s => s.filter(r => r.uid !== uid))
    } finally {
      setDeleting(d => { const n = { ...d }; delete n[uid]; return n })
    }
  }

  if (!clinic) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 w-full max-w-lg max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">Staff — {clinic.clinicName || `Dr. ${clinic.firstName} ${clinic.lastName}`}</h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Receptionist accounts for this clinic</p>
          </div>
          <button onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 rounded-lg transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* Created credentials banner */}
          {done && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-xl p-4 space-y-2">
              <p className="text-sm font-bold text-green-800 dark:text-green-300">Receptionist account created</p>
              <div className="text-xs space-y-1">
                <p className="text-green-700 dark:text-green-400">Email: <span className="font-mono font-semibold">{done.email}</span></p>
                <p className="text-green-700 dark:text-green-400">Password: <span className="font-mono font-semibold select-all">{done.password}</span></p>
              </div>
              <p className="text-xs text-amber-600 dark:text-amber-400">Share these credentials. Ask them to change the password after first login.</p>
              <button onClick={() => setDone(null)} className="text-xs text-green-600 dark:text-green-400 hover:underline">Dismiss</button>
            </div>
          )}

          {/* Staff list */}
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
              Current Staff {staff !== null && `(${staff.length})`}
            </p>
            {staff === null ? (
              <div className="flex items-center gap-2 py-4 text-gray-400 text-sm">
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Loading…
              </div>
            ) : loadErr ? (
              <p className="text-sm text-red-500 dark:text-red-400">{loadErr}</p>
            ) : staff.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500 py-2">No receptionists added yet.</p>
            ) : (
              <div className="space-y-2">
                {staff.map(r => (
                  <div key={r.uid} className="flex items-center justify-between gap-3 bg-gray-50 dark:bg-gray-700/40 rounded-xl px-4 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/40 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-purple-700 dark:text-purple-300">
                        {r.name?.[0]?.toUpperCase() ?? '?'}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">{r.name}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{r.email}</p>
                      </div>
                    </div>
                    <button onClick={() => handleDelete(r.uid)} disabled={deleting[r.uid]}
                      className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors p-1 flex-shrink-0 disabled:opacity-50">
                      {deleting[r.uid] ? (
                        <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                        </svg>
                      ) : (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                        </svg>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add receptionist form */}
          {!showForm ? (
            <button onClick={() => setShowForm(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-xl text-sm font-medium text-gray-500 dark:text-gray-400 hover:border-primary-300 dark:hover:border-primary-700 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
              </svg>
              Add Receptionist
            </button>
          ) : (
            <form onSubmit={handleCreate} className="border border-gray-200 dark:border-gray-600 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">New Receptionist</p>
              <div>
                <label className="form-label">Full Name *</label>
                <input value={form.name} onChange={e => set('name', e.target.value)} required placeholder="Jane Doe" className="input-field"/>
              </div>
              <div>
                <label className="form-label">Email *</label>
                <input type="email" value={form.email} onChange={e => set('email', e.target.value)} required placeholder="jane@clinic.com" className="input-field"/>
              </div>
              <div>
                <label className="form-label">Temporary Password *</label>
                <input type="text" value={form.password} onChange={e => set('password', e.target.value)}
                  required minLength={6} placeholder="Min 6 characters" className="input-field font-mono"/>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">They should change this after first login.</p>
              </div>
              {formErr && <p className="text-sm text-red-600 dark:text-red-400">{formErr}</p>}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => { setShowForm(false); setForm(BLANK_STAFF); setFormErr('') }}
                  className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 px-3 py-2 bg-primary-500 hover:bg-primary-600 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2">
                  {saving && <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
                  {saving ? 'Creating…' : 'Create Account'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Create Account Modal ──────────────────────────────────────────────────────

function CreateAccountModal({ open, onClose, onCreated, doctors = [] }) {
  const [role,    setRole]    = useState('doctor')
  const [form,    setForm]    = useState(BLANK_FORM)
  const [recForm, setRecForm] = useState(BLANK_RECEPTIONIST)
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)
  const [done,    setDone]    = useState(null) // { email, password, role }

  const setF  = (k, v) => { setForm(f => ({ ...f, [k]: v }));    setError('') }
  const setRF = (k, v) => { setRecForm(f => ({ ...f, [k]: v })); setError('') }

  const switchRole = (r) => {
    setRole(r)
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      if (role === 'doctor') {
        const res  = await adminFetch('/api/admin/create-doctor', { method: 'POST', body: JSON.stringify(form) })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        setDone({ email: form.email, password: form.password, role: 'doctor' })
      } else {
        if (!recForm.doctorId) throw new Error('Please select a clinic.')
        const res  = await adminFetch('/api/admin/staff', { method: 'POST', body: JSON.stringify(recForm) })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        setDone({ email: recForm.email, password: recForm.password, role: 'receptionist' })
      }
      onCreated?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setRole('doctor')
    setForm(BLANK_FORM); setRecForm(BLANK_RECEPTIONIST)
    setError(''); setDone(null)
    onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
          <h2 className="text-base font-bold text-gray-900 dark:text-white">Create Account</h2>
          <button onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 rounded-lg transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {done ? (
          <div className="p-6 space-y-4 overflow-y-auto">
            <div className="flex items-start gap-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-xl p-4">
              <svg className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
              </svg>
              <div>
                <p className="text-sm font-bold text-green-800 dark:text-green-300">Account created successfully</p>
                <p className="text-xs text-green-700 dark:text-green-400 mt-1">
                  Share these credentials with the {done.role}.
                </p>
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 space-y-2">
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide font-semibold">Email</p>
                <p className="text-sm font-mono text-gray-800 dark:text-gray-200 mt-0.5">{done.email}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide font-semibold">Temporary Password</p>
                <p className="text-sm font-mono text-gray-800 dark:text-gray-200 mt-0.5 select-all">{done.password}</p>
              </div>
            </div>
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Ask them to change their password after first login from the Settings page.
            </p>
            <button onClick={handleClose}
              className="w-full px-4 py-2.5 bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold rounded-xl transition-colors">
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">

            {/* Role selector */}
            <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-700 rounded-xl">
              <button type="button" onClick={() => switchRole('doctor')}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${
                  role === 'doctor'
                    ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}>
                Doctor
              </button>
              <button type="button" onClick={() => switchRole('receptionist')}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${
                  role === 'receptionist'
                    ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}>
                Receptionist
              </button>
            </div>

            {role === 'doctor' ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="form-label">First Name *</label>
                    <input value={form.firstName} onChange={e => setF('firstName', e.target.value)} required className="input-field"/>
                  </div>
                  <div>
                    <label className="form-label">Last Name *</label>
                    <input value={form.lastName} onChange={e => setF('lastName', e.target.value)} required className="input-field"/>
                  </div>
                </div>
                <div>
                  <label className="form-label">Email *</label>
                  <input type="email" value={form.email} onChange={e => setF('email', e.target.value)} required className="input-field"/>
                </div>
                <div>
                  <label className="form-label">Clinic Name</label>
                  <input value={form.clinicName} onChange={e => setF('clinicName', e.target.value)} className="input-field"/>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="form-label">Specialization</label>
                    <select value={form.specialization} onChange={e => setF('specialization', e.target.value)} className="input-field">
                      {SPECIALIZATIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Phone</label>
                    <input value={form.phone} onChange={e => setF('phone', e.target.value)} className="input-field"/>
                  </div>
                </div>
                <div>
                  <label className="form-label">Temporary Password *</label>
                  <input type="text" value={form.password} onChange={e => setF('password', e.target.value)}
                    required minLength={6} placeholder="Min 6 characters" className="input-field font-mono"/>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">The doctor should change this after first login.</p>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="form-label">Clinic *</label>
                  <select value={recForm.doctorId} onChange={e => setRF('doctorId', e.target.value)} required className="input-field">
                    <option value="">Select a clinic…</option>
                    {doctors.map(d => (
                      <option key={d.uid} value={d.uid}>
                        {d.clinicName ? `${d.clinicName} — Dr. ${d.firstName} ${d.lastName}` : `Dr. ${d.firstName} ${d.lastName}`}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">Full Name *</label>
                  <input value={recForm.name} onChange={e => setRF('name', e.target.value)} required placeholder="Jane Doe" className="input-field"/>
                </div>
                <div>
                  <label className="form-label">Email *</label>
                  <input type="email" value={recForm.email} onChange={e => setRF('email', e.target.value)} required placeholder="jane@clinic.com" className="input-field"/>
                </div>
                <div>
                  <label className="form-label">Temporary Password *</label>
                  <input type="text" value={recForm.password} onChange={e => setRF('password', e.target.value)}
                    required minLength={6} placeholder="Min 6 characters" className="input-field font-mono"/>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">They should change this after first login.</p>
                </div>
              </>
            )}

            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={handleClose}
                className="flex-1 px-4 py-2 border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={loading}
                className="flex-1 px-4 py-2 bg-primary-500 hover:bg-primary-600 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2">
                {loading && <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
                {loading ? 'Creating…' : 'Create Account'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const { doctor, loading: authLoading } = useAuth()
  const router     = useRouter()

  const [enriched,  setEnriched]    = useState([])
  const [loading,   setLoading]     = useState(true)
  const [apiError,  setApiError]    = useState('')
  const [search,    setSearch]      = useState('')
  const [sort,      setSort]        = useState({ key: 'createdAt', dir: -1 })
  const [showCreate, setShowCreate] = useState(false)
  const [staffModal, setStaffModal] = useState(null) // { uid, clinicName, firstName, lastName }
  const [toggling,   setToggling]   = useState({}) // uid → 'viewOnly'|'isAdmin'

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

  useEffect(() => {
    if (authLoading || !doctor?.isAdmin) return
    fetchDoctors()
  }, [doctor, authLoading])

  const handleToggle = async (uid, field, currentVal) => {
    setToggling(t => ({ ...t, [`${uid}-${field}`]: true }))
    try {
      await adminFetch('/api/admin/create-doctor', {
        method: 'PATCH',
        body: JSON.stringify({ uid, [field]: !currentVal }),
      })
      setEnriched(prev => prev.map(d => d.uid === uid ? { ...d, [field]: !currentVal } : d))
    } finally {
      setToggling(t => { const n = { ...t }; delete n[`${uid}-${field}`]; return n })
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
      <CreateAccountModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => { setShowCreate(false); fetchDoctors() }}
        doctors={enriched}
      />
      {staffModal && (
        <ManageStaffModal
          clinic={staffModal}
          onClose={() => setStaffModal(null)}
        />
      )}

      <div className="space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <StatCard label="Registered Clinics" value={stats.total}      color="primary" />
          <StatCard label="Active"              value={stats.active}     color="green"   />
          <StatCard label="Trial"               value={stats.trial}      color="blue"    />
          <StatCard label="Expired"             value={stats.expired}    color="red"     />
          <StatCard label="Logged In Today"     value={stats.todayLogin} color="yellow"  />
        </div>

        {/* Client list */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center gap-3">
            <h3 className="font-semibold text-gray-900 dark:text-white flex-1">
              All Registered Clients
              {!loading && <span className="ml-2 text-sm font-normal text-gray-400">({filtered.length})</span>}
            </h3>

            {/* Search */}
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

            {/* Create account */}
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold rounded-xl transition-colors whitespace-nowrap flex-shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
              </svg>
              Create Account
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
              <table className="w-full min-w-[860px]">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/30">
                    {[
                      { key: 'clinicName',     label: 'Clinic'         },
                      { key: 'firstName',      label: 'Doctor'         },
                      { key: 'email',          label: 'Email'          },
                      { key: 'specialization', label: 'Specialization' },
                      { key: 'subscription',   label: 'Plan'           },
                      { key: 'createdAt',      label: 'Joined'         },
                      { key: 'lastSignInTime', label: 'Last Login'     },
                      { key: null,             label: 'Access'         },
                      { key: null,             label: 'Actions'        },
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
                    const isMe     = d.uid === doctor?.id
                    const initials = `${d.firstName?.[0] ?? ''}${d.lastName?.[0] ?? ''}`.toUpperCase() || '?'
                    return (
                      <tr key={d.uid}
                        className={`hover:bg-gray-50/60 dark:hover:bg-gray-700/30 transition-colors ${isMe ? 'bg-primary-50/40 dark:bg-primary-900/10' : ''}`}>

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
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                              Dr. {d.firstName} {d.lastName}
                            </p>
                            {isMe && <span className="text-xs text-primary-500">(You)</span>}
                            {d.isAdmin && (
                              <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-1.5 py-0.5 rounded-full font-semibold">Admin</span>
                            )}
                          </div>
                        </td>

                        {/* Email */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1">
                            <p className="text-xs text-gray-600 dark:text-gray-400">{d.email || '—'}</p>
                            {d.emailVerified && (
                              <svg className="w-3 h-3 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                              </svg>
                            )}
                          </div>
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
                        <td className="px-4 py-3.5"><LoginCell isoStr={d.lastSignInTime} /></td>

                        {/* Access (viewOnly toggle) */}
                        <td className="px-4 py-3.5">
                          {!isMe && (
                            <button
                              disabled={!!toggling[`${d.uid}-viewOnly`]}
                              onClick={() => handleToggle(d.uid, 'viewOnly', d.viewOnly)}
                              title={d.viewOnly ? 'Click to restore full access' : 'Click to restrict to view-only'}
                              className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-all disabled:opacity-50 ${
                                d.viewOnly
                                  ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40'
                                  : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/40'
                              }`}>
                              {toggling[`${d.uid}-viewOnly`] ? (
                                <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                                </svg>
                              ) : d.viewOnly ? (
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                                </svg>
                              ) : (
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                </svg>
                              )}
                              {d.viewOnly ? 'View Only' : 'Full Access'}
                            </button>
                          )}
                        </td>

                        {/* Actions (staff + isAdmin toggle) */}
                        <td className="px-4 py-3.5 pr-5">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setStaffModal({ uid: d.uid, clinicName: d.clinicName, firstName: d.firstName, lastName: d.lastName })}
                              className="inline-flex items-center gap-1 text-xs font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/40 border border-purple-200 dark:border-purple-700 px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
                              </svg>
                              Staff
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </AppLayout>
  )
}
