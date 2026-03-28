'use client'

import { useState, useEffect } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { useAuth } from '@/context/AuthContext'
import { auth } from '@/lib/firebase'
import {
  isGoogleCalendarEnabled,
  isGoogleCalendarConnected,
  connectGoogleCalendar,
  disconnectGoogleCalendar,
} from '@/lib/googleCalendar'

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

  const [gcalConnected, setGcalConnected] = useState(false)
  const [gcalLoading, setGcalLoading]     = useState(false)
  const [gcalError, setGcalError]         = useState('')

  useEffect(() => { setGcalConnected(isGoogleCalendarConnected()) }, [])

  const handleGcalConnect = async () => {
    setGcalLoading(true)
    setGcalError('')
    try {
      await connectGoogleCalendar()
      setGcalConnected(true)
    } catch (err) {
      setGcalError(err.message)
    } finally {
      setGcalLoading(false)
    }
  }

  const handleGcalDisconnect = () => {
    disconnectGoogleCalendar()
    setGcalConnected(false)
  }

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
      {
        const { EmailAuthProvider, reauthenticateWithCredential, updatePassword } = await import('firebase/auth')
        const cred = EmailAuthProvider.credential(doctor.email, pwForm.current)
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

        {/* Google Calendar integration */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
            {/* Google Calendar icon */}
            <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 48 48" fill="none">
              <path d="M34 8H14a6 6 0 00-6 6v20a6 6 0 006 6h20a6 6 0 006-6V14a6 6 0 00-6-6z" fill="#fff" stroke="#dadce0" strokeWidth="2"/>
              <path d="M34 8H14a6 6 0 00-6 6v4h32v-4a6 6 0 00-6-6z" fill="#1A73E8"/>
              <rect x="8" y="18" width="32" height="2" fill="#dadce0"/>
              <circle cx="17" cy="8" r="2" fill="#1A73E8"/>
              <circle cx="31" cy="8" r="2" fill="#1A73E8"/>
              <text x="24" y="34" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#1A73E8">G</text>
            </svg>
            <div>
              <h2 className="font-semibold text-gray-900">Google Calendar</h2>
              <p className="text-sm text-gray-500 mt-0.5">Auto-sync appointments to your Google Calendar.</p>
            </div>
          </div>

          <div className="p-6">
            {!isGoogleCalendarEnabled ? (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                <p className="text-sm text-amber-800 font-medium mb-1">Configuration required</p>
                <p className="text-xs text-amber-700">
                  Set <code className="bg-amber-100 px-1 rounded">NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> in your <code className="bg-amber-100 px-1 rounded">.env.local</code> to enable Google Calendar sync.
                </p>
                <p className="text-xs text-amber-600 mt-2">
                  Go to Google Cloud Console → Credentials → Create OAuth 2.0 Client ID (Web application).
                </p>
              </div>
            ) : gcalConnected ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-2.5 h-2.5 bg-green-500 rounded-full"/>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Connected</p>
                    <p className="text-xs text-gray-400">New appointments will sync automatically.</p>
                  </div>
                </div>
                <button onClick={handleGcalDisconnect}
                  className="text-sm text-red-500 hover:text-red-700 font-medium border border-red-200 hover:border-red-300 px-4 py-1.5 rounded-lg transition-colors">
                  Disconnect
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Not connected</p>
                  <p className="text-xs text-gray-400 mt-0.5">Connect to sync appointments both ways.</p>
                </div>
                <button onClick={handleGcalConnect} disabled={gcalLoading}
                  className="flex items-center gap-2 bg-white border border-gray-300 hover:border-blue-400 hover:bg-blue-50 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50">
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
              <p className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">{gcalError}</p>
            )}

            {gcalConnected && (
              <div className="mt-4 bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
                <p className="text-xs font-semibold text-blue-800 mb-1">What syncs automatically</p>
                <ul className="text-xs text-blue-700 space-y-0.5">
                  <li>✓ New appointment → creates event in Google Calendar</li>
                  <li>✓ Status/time change → updates the event</li>
                  <li>✓ Appointment deleted → removes from Google Calendar</li>
                </ul>
              </div>
            )}
          </div>
        </div>

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
