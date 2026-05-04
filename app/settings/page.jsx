'use client'

import { useState, useEffect } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { useAuth } from '@/context/AuthContext'
import { auth } from '@/lib/firebase'
import { useTheme } from '@/hooks/useTheme'
import { THEMES } from '@/lib/themes'
import { DATE_FORMATS, CURRENCIES, formatDate as fmtDatePreview, formatCurrency as fmtCurrencyPreview } from '@/lib/preferences'
import { DEFAULT_REFERRAL_SOURCES, getReferralSources } from '@/lib/referralSources'
import { DEFAULT_BILLING_STATUSES, BILLING_STATUS_COLORS, getBillingStatuses } from '@/lib/billingStatuses'
import {
  isGoogleCalendarEnabled,
  isGoogleCalendarConnected,
  connectGoogleCalendar,
  disconnectGoogleCalendar,
} from '@/lib/googleCalendar'
import { appointmentService } from '@/services/appointmentService'
import { sendWhatsAppMessage } from '@/lib/whatsappApi'

const SPECIALIZATIONS = [
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
  { value: 'other',         label: 'Other' },
]

export default function SettingsPage() {
  const { doctor, updateProfile, generateReceptionistCode, isReceptionist } = useAuth()
  const { dark, toggle, colorTheme, setTheme } = useTheme()

  const [form, setForm] = useState({
    clinicName:     doctor?.clinicName     ?? '',
    firstName:      doctor?.firstName      ?? '',
    lastName:       doctor?.lastName       ?? '',
    phone:          doctor?.phone          ?? '',
    specialization: doctor?.specialization ?? '',
    licenseNumber:  doctor?.licenseNumber  ?? '',
  })

  const [gcalConnected, setGcalConnected] = useState(false)
  const [gcalLoading, setGcalLoading]     = useState(false)
  const [gcalError, setGcalError]         = useState('')
  const [gcalSyncing, setGcalSyncing]     = useState(false)
  const [gcalSyncResult, setGcalSyncResult] = useState(null)

  useEffect(() => { setGcalConnected(isGoogleCalendarConnected()) }, [])

  const [waTestPhone,  setWaTestPhone]  = useState('')
  const [waTestResult, setWaTestResult] = useState(null)
  const [waTesting,    setWaTesting]    = useState(false)

  const handleWaTest = async () => {
    if (!waTestPhone.trim()) { setWaTestResult({ ok: false, msg: 'Enter a phone number.' }); return }
    setWaTesting(true)
    setWaTestResult(null)
    try {
      await sendWhatsAppMessage(null, waTestPhone.trim(), `Hello from ${doctor?.clinicName || 'ClinicCRM'}! WhatsApp messaging is working correctly.`)
      setWaTestResult({ ok: true, msg: 'Test message sent successfully!' })
    } catch (err) {
      setWaTestResult({ ok: false, msg: err.message })
    } finally {
      setWaTesting(false)
    }
  }

  const handleGcalConnect = async () => {
    setGcalLoading(true)
    setGcalError('')
    try {
      await connectGoogleCalendar()
      setGcalConnected(true)
      updateProfile({ googleCalendarConnected: true }).catch(() => {})
    } catch (err) {
      setGcalError(err.message)
    } finally {
      setGcalLoading(false)
    }
  }

  const handleGcalDisconnect = () => {
    disconnectGoogleCalendar()
    setGcalConnected(false)
    setGcalSyncResult(null)
    updateProfile({ googleCalendarConnected: false }).catch(() => {})
  }

  const handleGcalSyncAll = async () => {
    setGcalSyncing(true)
    setGcalSyncResult(null)
    setGcalError('')
    try {
      const result = await appointmentService.syncAllToGoogleCalendar()
      setGcalSyncResult(result)
    } catch (err) {
      setGcalError(err.message)
    } finally {
      setGcalSyncing(false)
    }
  }

  const [prefForm, setPrefForm]   = useState({
    dateFormat: doctor?.dateFormat ?? 'DD/MM/YYYY',
    currency:   doctor?.currency   ?? 'INR',
  })
  const [prefSaving, setPrefSaving] = useState(false)
  const [prefSaved,  setPrefSaved]  = useState(false)

  const handlePrefSave = async () => {
    setPrefSaving(true)
    setPrefSaved(false)
    try {
      await updateProfile(prefForm)
      setPrefSaved(true)
      setTimeout(() => setPrefSaved(false), 3000)
    } finally {
      setPrefSaving(false)
    }
  }

  // Referral sources management
  const [refSources,  setRefSources]  = useState(() => getReferralSources(doctor?.referralSources))
  const [refInput,    setRefInput]    = useState('')
  const [editingIdx,  setEditingIdx]  = useState(null)
  const [editLabel,   setEditLabel]   = useState('')
  const [refSaving,   setRefSaving]   = useState(false)
  const [refSaved,    setRefSaved]    = useState(false)

  const handleRefSave = async () => {
    setRefSaving(true)
    setRefSaved(false)
    try {
      await updateProfile({ referralSources: refSources })
      setRefSaved(true)
      setTimeout(() => setRefSaved(false), 3000)
    } finally {
      setRefSaving(false)
    }
  }

  const addRefSource = () => {
    const label = refInput.trim()
    if (!label) return
    const value = label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
    if (refSources.some(s => s.value === value || s.label.toLowerCase() === label.toLowerCase())) return
    setRefSources(prev => [...prev, { value, label }])
    setRefInput('')
  }

  const removeRefSource = (idx) => setRefSources(prev => prev.filter((_, i) => i !== idx))

  const startEdit = (idx) => { setEditingIdx(idx); setEditLabel(refSources[idx].label) }
  const commitEdit = (idx) => {
    const label = editLabel.trim()
    if (!label) { setEditingIdx(null); return }
    setRefSources(prev => prev.map((s, i) => i === idx ? { ...s, label } : s))
    setEditingIdx(null)
  }

  // Billing statuses management
  const [billStatuses,    setBillStatuses]    = useState(() => getBillingStatuses(doctor?.billingStatuses))
  const [billInput,       setBillInput]       = useState('')
  const [billColor,       setBillColor]       = useState('gray')
  const [billEditingIdx,  setBillEditingIdx]  = useState(null)
  const [billEditLabel,   setBillEditLabel]   = useState('')
  const [billEditColor,   setBillEditColor]   = useState('gray')
  const [billSaving,      setBillSaving]      = useState(false)
  const [billSaved,       setBillSaved]       = useState(false)

  const handleBillStatusSave = async () => {
    setBillSaving(true)
    setBillSaved(false)
    try {
      await updateProfile({ billingStatuses: billStatuses })
      setBillSaved(true)
      setTimeout(() => setBillSaved(false), 3000)
    } finally {
      setBillSaving(false)
    }
  }

  const addBillStatus = () => {
    const label = billInput.trim()
    if (!label) return
    const value = label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
    if (billStatuses.some(s => s.value === value || s.label.toLowerCase() === label.toLowerCase())) return
    setBillStatuses(prev => [...prev, { value, label, color: billColor }])
    setBillInput('')
    setBillColor('gray')
  }

  const removeBillStatus = (idx) => setBillStatuses(prev => prev.filter((_, i) => i !== idx))

  const startBillEdit = (idx) => {
    setBillEditingIdx(idx)
    setBillEditLabel(billStatuses[idx].label)
    setBillEditColor(billStatuses[idx].color ?? 'gray')
  }
  const commitBillEdit = (idx) => {
    const label = billEditLabel.trim()
    if (!label) { setBillEditingIdx(null); return }
    setBillStatuses(prev => prev.map((s, i) => i === idx ? { ...s, label, color: billEditColor } : s))
    setBillEditingIdx(null)
  }

  const [pwForm, setPwForm]     = useState({ current: '', next: '', confirm: '' })
  const [saving, setSaving]     = useState(false)
  const [pwSaving, setPwSaving] = useState(false)
  const [saved, setSaved]       = useState(false)
  const [pwError, setPwError]   = useState('')
  const [pwSaved, setPwSaved]   = useState(false)
  const [error, setError]       = useState('')

  const [codeGenerating, setCodeGenerating] = useState(false)
  const [codeCopied, setCodeCopied]         = useState(false)

  const handleGenerateCode = async () => {
    setCodeGenerating(true)
    try { await generateReceptionistCode() } finally { setCodeGenerating(false) }
  }

  const handleCopyCode = () => {
    if (!doctor?.inviteCode) return
    navigator.clipboard.writeText(doctor.inviteCode).catch(() => {})
    setCodeCopied(true)
    setTimeout(() => setCodeCopied(false), 2000)
  }

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    setSaved(false)
    setError('')
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError('First name and last name are required.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await updateProfile(form)
      setSaved(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handlePasswordChange = async (e) => {
    e.preventDefault()
    setPwError('')
    setPwSaved(false)
    if (!pwForm.next || pwForm.next.length < 8) {
      setPwError('New password must be at least 8 characters.')
      return
    }
    if (pwForm.next !== pwForm.confirm) {
      setPwError('Passwords do not match.')
      return
    }
    setPwSaving(true)
    try {
      {
        const { EmailAuthProvider, reauthenticateWithCredential, updatePassword } = await import('firebase/auth')
        const accountEmail = isReceptionist ? (doctor._receptionistEmail ?? doctor.email) : doctor.email
        const cred = EmailAuthProvider.credential(accountEmail, pwForm.current)
        await reauthenticateWithCredential(auth.currentUser, cred)
        await updatePassword(auth.currentUser, pwForm.next)
      }
      setPwForm({ current: '', next: '', confirm: '' })
      setPwSaved(true)
    } catch (err) {
      setPwError(err.message?.includes('auth/wrong-password') || err.message?.includes('auth/invalid-credential')
        ? 'Current password is incorrect.'
        : err.message)
    } finally {
      setPwSaving(false)
    }
  }

  return (
    <AppLayout title={isReceptionist ? 'My Preferences' : 'Settings'}>
      <div className="max-w-2xl space-y-8">

        {/* ── Appearance ───────────────────────────────────────────────────── */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
            <h2 className="font-semibold text-gray-900 dark:text-white">Appearance</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Personalise the look of the app. Saved to your account.</p>
          </div>

          <div className="p-6 space-y-6">

            {/* Dark / Light mode toggle */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Dark Mode</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Switch between light and dark interface.</p>
              </div>
              <button
                onClick={toggle}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none
                  ${dark ? 'bg-primary-500' : 'bg-gray-200 dark:bg-gray-600'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform
                  ${dark ? 'translate-x-6' : 'translate-x-1'}`}/>
              </button>
            </div>

            {/* Color palette */}
            <div>
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-3">Accent Color</p>
              <div className="grid grid-cols-4 sm:grid-cols-7 gap-3">
                {THEMES.map(t => (
                  <button
                    key={t.key}
                    onClick={() => setTheme(t.key)}
                    title={t.label}
                    className={`group flex flex-col items-center gap-1.5 p-2 rounded-xl border-2 transition-all
                      ${colorTheme === t.key
                        ? 'border-gray-900 dark:border-white scale-105 shadow-md'
                        : 'border-transparent hover:border-gray-300 dark:hover:border-gray-500'}`}
                  >
                    {/* Swatch circle */}
                    <span
                      className="w-9 h-9 rounded-full shadow-inner flex items-center justify-center transition-transform group-hover:scale-110"
                      style={{ backgroundColor: t.swatch }}
                    >
                      {colorTheme === t.key && (
                        <svg className="w-4 h-4 text-white drop-shadow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/>
                        </svg>
                      )}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">{t.label}</span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
                Changes apply instantly and sync across your devices.
              </p>
            </div>

          </div>
        </div>

        {!isReceptionist && <>

        {/* ── Regional Preferences ─────────────────────────────────────────── */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
            <h2 className="font-semibold text-gray-900 dark:text-white">Regional Preferences</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Date format and currency used across the entire app.</p>
          </div>

          <div className="p-6 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="form-label">Date Format</label>
                <div className="relative">
                  <select
                    value={prefForm.dateFormat}
                    onChange={e => setPrefForm(p => ({ ...p, dateFormat: e.target.value }))}
                    className="input-field appearance-none pr-9"
                  >
                    {DATE_FORMATS.map(f => (
                      <option key={f.value} value={f.value}>{f.label} — e.g. {f.example}</option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
                    </svg>
                  </div>
                </div>
              </div>
              <div>
                <label className="form-label">Currency</label>
                <div className="relative">
                  <select
                    value={prefForm.currency}
                    onChange={e => setPrefForm(p => ({ ...p, currency: e.target.value }))}
                    className="input-field appearance-none pr-9"
                  >
                    {CURRENCIES.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded-lg px-4 py-2.5">
              <span className="font-medium text-gray-600 dark:text-gray-300">Preview:</span>
              <span>{fmtDatePreview('2026-04-09', prefForm.dateFormat)}</span>
              <span className="text-gray-300 dark:text-gray-600">·</span>
              <span>{fmtCurrencyPreview(1234.5, prefForm.currency)}</span>
            </div>
          </div>

          <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
            {prefSaved
              ? <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
                  Preferences saved.
                </p>
              : <span/>
            }
            <button onClick={handlePrefSave} disabled={prefSaving}
              className="bg-primary-500 hover:bg-primary-700 disabled:opacity-50 text-white text-sm font-medium px-6 py-2 rounded-lg transition-colors flex items-center gap-2">
              {prefSaving
                ? <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Saving…</>
                : 'Save Preferences'
              }
            </button>
          </div>
        </div>

        {/* ── Referral / Visit Sources ─────────────────────────────────────── */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
            <h2 className="font-semibold text-gray-900 dark:text-white">Referral / Visit Sources</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Customise the sources shown when registering a new patient. Used for filtering and reporting.
            </p>
          </div>

          <div className="p-6 space-y-4">
            {/* Source list */}
            <div className="space-y-2">
              {refSources.map((src, idx) => (
                <div key={src.value} className="flex items-center gap-2 group">
                  {editingIdx === idx ? (
                    <>
                      <input
                        autoFocus
                        value={editLabel}
                        onChange={e => setEditLabel(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') commitEdit(idx); if (e.key === 'Escape') setEditingIdx(null) }}
                        className="input-field flex-1 text-sm py-1.5"
                      />
                      <button onClick={() => commitEdit(idx)}
                        className="text-xs px-3 py-1.5 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-medium transition-colors">
                        Save
                      </button>
                      <button onClick={() => setEditingIdx(null)}
                        className="text-xs px-2 py-1.5 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5">
                        {src.label}
                        <span className="ml-2 text-xs text-gray-400 dark:text-gray-500 font-mono">{src.value}</span>
                      </span>
                      <button onClick={() => startEdit(idx)}
                        className="opacity-0 group-hover:opacity-100 text-xs px-2.5 py-1.5 text-gray-500 hover:text-primary-600 dark:hover:text-primary-400 border border-gray-200 dark:border-gray-600 hover:border-primary-300 dark:hover:border-primary-600 rounded-lg transition-all">
                        Edit
                      </button>
                      <button onClick={() => removeRefSource(idx)}
                        className="opacity-0 group-hover:opacity-100 text-xs px-2.5 py-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 border border-gray-200 dark:border-gray-600 hover:border-red-300 dark:hover:border-red-700 rounded-lg transition-all">
                        ×
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* Add new source */}
            <div className="flex gap-2 pt-1">
              <input
                value={refInput}
                onChange={e => setRefInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addRefSource() } }}
                placeholder="e.g. Instagram, Walk-in, Google Ads…"
                className="input-field flex-1 text-sm"
              />
              <button onClick={addRefSource}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg transition-colors">
                + Add
              </button>
            </div>

            <button onClick={() => { setRefSources(DEFAULT_REFERRAL_SOURCES); setEditingIdx(null) }}
              className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:underline transition-colors">
              Reset to defaults
            </button>
          </div>

          <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
            {refSaved
              ? <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
                  Sources saved.
                </p>
              : <span/>
            }
            <button onClick={handleRefSave} disabled={refSaving}
              className="bg-primary-500 hover:bg-primary-700 disabled:opacity-50 text-white text-sm font-medium px-6 py-2 rounded-lg transition-colors flex items-center gap-2">
              {refSaving
                ? <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Saving…</>
                : 'Save Sources'
              }
            </button>
          </div>
        </div>

        {/* ── Billing Statuses ─────────────────────────────────────────────── */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
            <h2 className="font-semibold text-gray-900 dark:text-white">Billing Statuses</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Customise the statuses used on invoices across the app.
            </p>
          </div>

          <div className="p-6 space-y-4">
            <div className="space-y-2">
              {billStatuses.map((st, idx) => (
                <div key={st.value} className="flex items-center gap-2 group">
                  {billEditingIdx === idx ? (
                    <>
                      <input
                        autoFocus
                        value={billEditLabel}
                        onChange={e => setBillEditLabel(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') commitBillEdit(idx); if (e.key === 'Escape') setBillEditingIdx(null) }}
                        className="input-field flex-1 text-sm py-1.5"
                      />
                      <select value={billEditColor} onChange={e => setBillEditColor(e.target.value)} className="input-field w-28 text-sm py-1.5">
                        {BILLING_STATUS_COLORS.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <button onClick={() => commitBillEdit(idx)}
                        className="text-xs px-3 py-1.5 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-medium transition-colors">
                        Save
                      </button>
                      <button onClick={() => setBillEditingIdx(null)}
                        className="text-xs px-2 py-1.5 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full bg-${st.color}-500 flex-shrink-0`}/>
                        {st.label}
                        <span className="ml-1 text-xs text-gray-400 dark:text-gray-500 font-mono">{st.value}</span>
                      </span>
                      <button onClick={() => startBillEdit(idx)}
                        className="opacity-0 group-hover:opacity-100 text-xs px-2.5 py-1.5 text-gray-500 hover:text-primary-600 dark:hover:text-primary-400 border border-gray-200 dark:border-gray-600 hover:border-primary-300 dark:hover:border-primary-600 rounded-lg transition-all">
                        Edit
                      </button>
                      <button onClick={() => removeBillStatus(idx)}
                        className="opacity-0 group-hover:opacity-100 text-xs px-2.5 py-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 border border-gray-200 dark:border-gray-600 hover:border-red-300 dark:hover:border-red-700 rounded-lg transition-all">
                        ×
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-1">
              <input
                value={billInput}
                onChange={e => setBillInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addBillStatus() } }}
                placeholder="e.g. Partially Paid, Insurance Pending…"
                className="input-field flex-1 text-sm"
              />
              <select value={billColor} onChange={e => setBillColor(e.target.value)} className="input-field w-28 text-sm">
                {BILLING_STATUS_COLORS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <button onClick={addBillStatus}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg transition-colors">
                + Add
              </button>
            </div>

            <button onClick={() => { setBillStatuses(DEFAULT_BILLING_STATUSES); setBillEditingIdx(null) }}
              className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:underline transition-colors">
              Reset to defaults
            </button>
          </div>

          <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
            {billSaved
              ? <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
                  Statuses saved.
                </p>
              : <span/>
            }
            <button onClick={handleBillStatusSave} disabled={billSaving}
              className="bg-primary-500 hover:bg-primary-700 disabled:opacity-50 text-white text-sm font-medium px-6 py-2 rounded-lg transition-colors flex items-center gap-2">
              {billSaving
                ? <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Saving…</>
                : 'Save Statuses'
              }
            </button>
          </div>
        </div>

        {/* Profile & clinic section */}
        <form onSubmit={handleSave} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
            <h2 className="font-semibold text-gray-900 dark:text-white">Clinic & Profile</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">This information appears on your dashboard and invoices.</p>
          </div>

          <div className="p-6 space-y-5">

            {/* Clinic name */}
            <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800 rounded-xl p-4">
              <label className="block text-sm font-semibold text-primary-800 dark:text-primary-300 mb-1.5">
                Clinic / Hospital Name
              </label>
              <input
                type="text"
                name="clinicName"
                value={form.clinicName}
                onChange={handleChange}
                placeholder="e.g. Swastik Homoeopathy, City Medical Center"
                className="input-field bg-white dark:bg-gray-700"
              />
              <p className="text-xs text-primary-600 dark:text-primary-400 mt-1.5">Shown in the dashboard header and on invoices.</p>
            </div>

            {/* Name row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="form-label">First Name</label>
                <input type="text" name="firstName" value={form.firstName} onChange={handleChange} className="input-field" />
              </div>
              <div>
                <label className="form-label">Last Name</label>
                <input type="text" name="lastName" value={form.lastName} onChange={handleChange} className="input-field" />
              </div>
            </div>

            {/* Email — read only */}
            <div>
              <label className="form-label">Email Address</label>
              <input
                type="email"
                value={doctor?.email ?? ''}
                readOnly
                className="input-field bg-gray-50 dark:bg-gray-700/50 text-gray-400 dark:text-gray-500 cursor-not-allowed"
              />
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Email cannot be changed.</p>
            </div>

            {/* Phone + Specialization */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="form-label">Phone Number</label>
                <input type="text" name="phone" value={form.phone} onChange={handleChange} placeholder="+91 98765 43210" className="input-field" />
              </div>
              <div>
                <label className="form-label">Specialization</label>
                <div className="relative">
                  <select
                    name="specialization"
                    value={form.specialization}
                    onChange={handleChange}
                    className="input-field appearance-none pr-9"
                  >
                    <option value="">Select…</option>
                    {SPECIALIZATIONS.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* License number */}
            <div>
              <label className="form-label">License Number</label>
              <input type="text" name="licenseNumber" value={form.licenseNumber} onChange={handleChange} placeholder="MED-123456" className="input-field" />
            </div>

            {error && (
              <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg px-4 py-2">{error}</p>
            )}
            {saved && (
              <p className="text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg px-4 py-2 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Profile saved successfully.
              </p>
            )}
          </div>

          <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex justify-end">
            <button type="submit" disabled={saving}
              className="bg-primary-500 hover:bg-primary-700 disabled:opacity-50 text-white text-sm font-medium px-6 py-2 rounded-lg transition-colors flex items-center gap-2">
              {saving ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Saving…
                </>
              ) : 'Save Changes'}
            </button>
          </div>
        </form>

        {/* Google Calendar integration */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center gap-3">
            <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 48 48" fill="none">
              <path d="M34 8H14a6 6 0 00-6 6v20a6 6 0 006 6h20a6 6 0 006-6V14a6 6 0 00-6-6z" fill="#fff" stroke="#dadce0" strokeWidth="2"/>
              <path d="M34 8H14a6 6 0 00-6 6v4h32v-4a6 6 0 00-6-6z" fill="#1A73E8"/>
              <rect x="8" y="18" width="32" height="2" fill="#dadce0"/>
              <circle cx="17" cy="8" r="2" fill="#1A73E8"/>
              <circle cx="31" cy="8" r="2" fill="#1A73E8"/>
              <text x="24" y="34" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#1A73E8">G</text>
            </svg>
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white">Google Calendar</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Auto-sync appointments to your Google Calendar.</p>
            </div>
          </div>

          <div className="p-6">
            {!isGoogleCalendarEnabled ? (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg px-4 py-3">
                <p className="text-sm text-amber-800 dark:text-amber-300 font-medium mb-1">Configuration required</p>
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Set <code className="bg-amber-100 dark:bg-amber-900/40 px-1 rounded">NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> in your <code className="bg-amber-100 dark:bg-amber-900/40 px-1 rounded">.env.local</code> to enable Google Calendar sync.
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-500 mt-2">
                  Go to Google Cloud Console → Credentials → Create OAuth 2.0 Client ID (Web application).
                </p>
              </div>
            ) : gcalConnected ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 bg-green-500 rounded-full"/>
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">Connected</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">New appointments will sync automatically.</p>
                    </div>
                  </div>
                  <button onClick={handleGcalDisconnect}
                    className="text-sm text-red-500 hover:text-red-700 font-medium border border-red-200 dark:border-red-700 hover:border-red-300 px-4 py-1.5 rounded-lg transition-colors">
                    Disconnect
                  </button>
                </div>
                <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 rounded-lg px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Sync existing appointments</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Push all past appointments that aren't on Google Calendar yet.</p>
                  </div>
                  <button onClick={handleGcalSyncAll} disabled={gcalSyncing}
                    className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex-shrink-0 ml-4">
                    {gcalSyncing ? (
                      <>
                        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                        </svg>
                        Syncing…
                      </>
                    ) : 'Sync Now'}
                  </button>
                </div>
                {gcalSyncResult && (
                  <div className={`rounded-lg px-4 py-3 text-sm ${gcalSyncResult.failed > 0 ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-amber-800 dark:text-amber-300' : 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 text-green-800 dark:text-green-300'}`}>
                    {gcalSyncResult.total === 0
                      ? 'All appointments are already synced to Google Calendar.'
                      : `Synced ${gcalSyncResult.synced} of ${gcalSyncResult.total} appointments.${gcalSyncResult.failed > 0 ? ` ${gcalSyncResult.failed} failed.` : ''}`}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-300">Not connected</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Connect to sync appointments both ways.</p>
                </div>
                <button onClick={handleGcalConnect} disabled={gcalLoading}
                  className="flex items-center gap-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:border-primary-400 hover:bg-primary-50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50">
                  {gcalLoading ? (
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" viewBox="0 0 48 48">
                      <path d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-22 0-1.3-.2-2.7-.5-4z" fill="#FFC107"/>
                      <path d="M6.3 14.7l7.1 5.2C15.2 16.5 19.3 14 24 14c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 16.3 2 9.6 7.3 6.3 14.7z" fill="#FF3D00"/>
                      <path d="M24 46c5.5 0 10.5-1.9 14.3-5.1l-6.6-5.5C29.7 37 27 38 24 38c-6.1 0-10.7-3.1-11.8-8.5H4.1C7.3 40.7 14.9 46 24 46z" fill="#4CAF50"/>
                      <path d="M44.5 20H24v8.5h11.8c-1 3-3.3 5.5-6.2 7l6.6 5.5C40.7 37.3 45 31.3 45 24c0-1.3-.2-2.7-.5-4z" fill="#1976D2"/>
                    </svg>
                  )}
                  {gcalLoading ? 'Connecting…' : 'Connect Google Calendar'}
                </button>
              </div>
            )}

            {gcalError && (
              <p className="mt-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg px-4 py-2">{gcalError}</p>
            )}

            {gcalConnected && (
              <div className="mt-4 bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800 rounded-lg px-4 py-3">
                <p className="text-xs font-semibold text-primary-800 dark:text-primary-300 mb-1.5">What syncs automatically</p>
                <ul className="text-xs text-primary-700 dark:text-primary-400 space-y-1">
                  <li>✓ New appointment → creates event in Google Calendar</li>
                  <li>✓ Status/time change → updates the event</li>
                  <li>✓ Appointment deleted → removes from Google Calendar</li>
                  <li className="text-primary-500 dark:text-primary-500">↑ Use "Sync Now" above to push older appointments that were created before connecting.</li>
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* ── WhatsApp via WATI ────────────────────────────────────────────── */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center gap-3">
            <svg className="w-5 h-5 flex-shrink-0 text-green-500" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white">WhatsApp Messaging</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Powered by WATI — send appointment reminders & follow-ups via WhatsApp.</p>
            </div>
            <span className="ml-auto flex items-center gap-1.5 text-xs font-medium text-green-600 dark:text-green-400">
              <span className="w-2 h-2 bg-green-500 rounded-full"/>Active
            </span>
          </div>

          <div className="p-6 space-y-5">
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 rounded-lg px-4 py-3">
              <p className="text-xs font-semibold text-green-800 dark:text-green-300 mb-1.5">Included in your subscription</p>
              <ul className="text-xs text-green-700 dark:text-green-400 space-y-1">
                <li>✓ Appointment reminders — from the Appointments page</li>
                <li>✓ Follow-up reminders — from the Follow-ups page</li>
                <li>✓ Invoice notifications — from the Billing page</li>
              </ul>
            </div>

            <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 space-y-3">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Send a test message</p>
              <div className="flex gap-2">
                <input
                  type="tel"
                  value={waTestPhone}
                  onChange={e => { setWaTestPhone(e.target.value); setWaTestResult(null) }}
                  placeholder="91XXXXXXXXXX (with country code)"
                  className="input-field flex-1 text-sm"
                />
                <button onClick={handleWaTest} disabled={waTesting}
                  className="flex items-center gap-2 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex-shrink-0">
                  {waTesting ? (
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                  ) : null}
                  {waTesting ? 'Sending…' : 'Send Test'}
                </button>
              </div>
              {waTestResult && (
                <p className={`text-xs px-3 py-2 rounded-lg ${waTestResult.ok ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'}`}>
                  {waTestResult.msg}
                </p>
              )}
            </div>
          </div>
        </div>

        </>} {/* end !isReceptionist */}

        {/* Change password section */}
        <form onSubmit={handlePasswordChange} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
            <h2 className="font-semibold text-gray-900 dark:text-white">Change Password</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Use a strong password of at least 8 characters.</p>
          </div>

          <div className="p-6 space-y-4">
            <div>
              <label className="form-label">Current Password</label>
              <input
                type="password"
                value={pwForm.current}
                onChange={e => setPwForm(p => ({ ...p, current: e.target.value }))}
                placeholder="Enter current password"
                className="input-field"
                autoComplete="current-password"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="form-label">New Password</label>
                <input
                  type="password"
                  value={pwForm.next}
                  onChange={e => setPwForm(p => ({ ...p, next: e.target.value }))}
                  placeholder="Min. 8 characters"
                  className="input-field"
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label className="form-label">Confirm Password</label>
                <input
                  type="password"
                  value={pwForm.confirm}
                  onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))}
                  placeholder="Re-enter new password"
                  className="input-field"
                  autoComplete="new-password"
                />
              </div>
            </div>

            {pwError && (
              <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg px-4 py-2">{pwError}</p>
            )}
            {pwSaved && (
              <p className="text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg px-4 py-2 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Password updated successfully.
              </p>
            )}
          </div>

          <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex justify-end">
            <button type="submit" disabled={pwSaving}
              className="bg-gray-900 dark:bg-gray-600 hover:bg-gray-700 dark:hover:bg-gray-500 disabled:opacity-50 text-white text-sm font-medium px-6 py-2 rounded-lg transition-colors">
              {pwSaving ? 'Updating…' : 'Update Password'}
            </button>
          </div>
        </form>

        {!isReceptionist && <>
        {/* ── Receptionist Access ──────────────────────────────────────────── */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
            <h2 className="font-semibold text-gray-900 dark:text-white">Receptionist Access</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Share this invite code with your receptionist so they can create an account linked to your clinic.
            </p>
          </div>

          <div className="p-6 space-y-4">
            {doctor?.inviteCode ? (
              <>
                <div>
                  <label className="form-label">Your Invite Code</label>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 font-mono text-lg tracking-widest text-center bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-4 py-3 text-gray-900 dark:text-white select-all">
                      {doctor.inviteCode}
                    </div>
                    <button onClick={handleCopyCode}
                      className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium rounded-lg border transition-colors flex-shrink-0
                        ${codeCopied
                          ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700 text-green-700 dark:text-green-400'
                          : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'}`}>
                      {codeCopied ? (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
                          </svg>
                          Copied!
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                          </svg>
                          Copy
                        </>
                      )}
                    </button>
                  </div>
                </div>
                <div className="flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <svg className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3a9 9 0 100 18A9 9 0 0012 3z"/>
                  </svg>
                  <span>Keep this code private. Anyone with it can join your clinic as a receptionist. You can generate a new code at any time to invalidate the old one.</span>
                </div>
                <button onClick={handleGenerateCode} disabled={codeGenerating}
                  className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 underline underline-offset-2 transition-colors disabled:opacity-50">
                  {codeGenerating ? 'Generating…' : 'Generate new code'}
                </button>
              </>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  No invite code yet. Generate one to allow a receptionist to join your clinic.
                </p>
                <button onClick={handleGenerateCode} disabled={codeGenerating}
                  className="btn-primary w-auto px-6">
                  {codeGenerating ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                      Generating…
                    </span>
                  ) : 'Generate Invite Code'}
                </button>
              </div>
            )}
          </div>
        </div>

        </>} {/* end !isReceptionist */}

      </div>
    </AppLayout>
  )
}
