'use client'

import { useState } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { useAuth } from '@/context/AuthContext'
import { isFirebaseConfigured } from '@/lib/firebase'

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
  const { doctor, updateProfile } = useAuth()

  const [form, setForm] = useState({
    clinicName:     doctor?.clinicName     ?? '',
    firstName:      doctor?.firstName      ?? '',
    lastName:       doctor?.lastName       ?? '',
    phone:          doctor?.phone          ?? '',
    specialization: doctor?.specialization ?? '',
    licenseNumber:  doctor?.licenseNumber  ?? '',
  })

  const [pwForm, setPwForm]   = useState({ current: '', next: '', confirm: '' })
  const [saving, setSaving]   = useState(false)
  const [pwSaving, setPwSaving] = useState(false)
  const [saved, setSaved]     = useState(false)
  const [pwError, setPwError] = useState('')
  const [pwSaved, setPwSaved] = useState(false)
  const [error, setError]     = useState('')

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
      if (isFirebaseConfigured) {
        const { EmailAuthProvider, reauthenticateWithCredential, updatePassword } = await import('firebase/auth')
        const { auth } = await import('@/lib/firebase')
        const cred = EmailAuthProvider.credential(doctor.email, pwForm.current)
        await reauthenticateWithCredential(auth.currentUser, cred)
        await updatePassword(auth.currentUser, pwForm.next)
      } else {
        const doctors = JSON.parse(localStorage.getItem('clinic_crm_doctors') || '{}')
        const found   = doctors[doctor.email]
        if (!found || found.passwordHash !== btoa(pwForm.current)) {
          throw new Error('Current password is incorrect.')
        }
        doctors[doctor.email].passwordHash = btoa(pwForm.next)
        localStorage.setItem('clinic_crm_doctors', JSON.stringify(doctors))
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
    <AppLayout title="Settings">
      <div className="max-w-2xl space-y-8">

        {/* Profile & clinic section */}
        <form onSubmit={handleSave} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Clinic & Profile</h2>
            <p className="text-sm text-gray-500 mt-0.5">This information appears on your dashboard and invoices.</p>
          </div>

          <div className="p-6 space-y-5">

            {/* Clinic name — highlighted */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
              <label className="block text-sm font-semibold text-blue-800 mb-1.5">
                Clinic / Hospital Name
              </label>
              <input
                type="text"
                name="clinicName"
                value={form.clinicName}
                onChange={handleChange}
                placeholder="e.g. Swastik Homoeopathy, City Medical Center"
                className="input-field bg-white"
              />
              <p className="text-xs text-blue-600 mt-1.5">Shown in the dashboard header and on invoices.</p>
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
                className="input-field bg-gray-50 text-gray-400 cursor-not-allowed"
              />
              <p className="text-xs text-gray-400 mt-1">Email cannot be changed.</p>
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
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">{error}</p>
            )}

            {saved && (
              <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Profile saved successfully.
              </p>
            )}
          </div>

          <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
            <button type="submit" disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-6 py-2 rounded-lg transition-colors flex items-center gap-2">
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

        {/* Change password section */}
        <form onSubmit={handlePasswordChange} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Change Password</h2>
            <p className="text-sm text-gray-500 mt-0.5">Use a strong password of at least 8 characters.</p>
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
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">{pwError}</p>
            )}
            {pwSaved && (
              <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Password updated successfully.
              </p>
            )}
          </div>

          <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
            <button type="submit" disabled={pwSaving}
              className="bg-gray-900 hover:bg-gray-700 disabled:opacity-50 text-white text-sm font-medium px-6 py-2 rounded-lg transition-colors">
              {pwSaving ? 'Updating…' : 'Update Password'}
            </button>
          </div>
        </form>

      </div>
    </AppLayout>
  )
}
