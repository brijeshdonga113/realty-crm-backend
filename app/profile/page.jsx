'use client'

import { useState } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { useAuth } from '@/context/AuthContext'
import { auth, db } from '@/lib/firebase'

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

export default function ProfilePage() {
  const { doctor, updateProfile, isReceptionist } = useAuth()

  // ── Profile form ────────────────────────────────────────────────────────────
  const [form, setForm] = useState({
    clinicName:     doctor?.clinicName          ?? '',
    firstName:      doctor?.firstName           ?? '',
    lastName:       doctor?.lastName            ?? '',
    phone:          doctor?.phone               ?? '',
    specialization: doctor?.specialization      ?? '',
    licenseNumber:  doctor?.licenseNumber       ?? '',
    recName:        doctor?._receptionistName   ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const [error,  setError]  = useState('')

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    setSaved(false)
    setError('')
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaved(false)
    setError('')

    if (isReceptionist) {
      if (!form.recName.trim()) { setError('Name is required.'); return }
      setSaving(true)
      try {
        const { doc, setDoc } = await import('firebase/firestore')
        await setDoc(doc(db, 'receptionists', doctor._receptionistUid), { name: form.recName.trim() }, { merge: true })
        await updateProfile({ _receptionistName: form.recName.trim() })
        setSaved(true)
      } catch {
        setError('Failed to save. Please try again.')
      } finally {
        setSaving(false)
      }
      return
    }

    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError('First name and last name are required.')
      return
    }
    setSaving(true)
    try {
      await updateProfile(form)
      setSaved(true)
    } catch {
      setError('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  // ── Logo upload ─────────────────────────────────────────────────────────────
  const [logoUploading, setLogoUploading] = useState(false)
  const [logoError,     setLogoError]     = useState('')

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!['image/svg+xml', 'image/png'].includes(file.type)) {
      setLogoError('Only SVG and PNG files are accepted.')
      return
    }
    if (file.size > 2 * 1024 * 1024) { setLogoError('File must be smaller than 2 MB.'); return }
    setLogoUploading(true)
    setLogoError('')
    try {
      const formData = new FormData()
      formData.append('file',     file)
      formData.append('doctorId', doctor.id)
      const res  = await fetch('/api/upload-logo', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed.')
      await updateProfile({ logoUrl: data.url })
    } catch (err) {
      console.error('[logo upload]', err)
      setLogoError('Upload failed. Please try again.')
    } finally {
      setLogoUploading(false)
      e.target.value = ''
    }
  }

  const handleLogoRemove = async () => {
    setLogoError('')
    try { await updateProfile({ logoUrl: '' }) } catch (err) { console.error('[logo remove]', err) }
  }

  // ── Password change ─────────────────────────────────────────────────────────
  const [pwForm,   setPwForm]   = useState({ current: '', next: '', confirm: '' })
  const [pwSaving, setPwSaving] = useState(false)
  const [pwError,  setPwError]  = useState('')
  const [pwSaved,  setPwSaved]  = useState(false)

  const handlePasswordChange = async (e) => {
    e.preventDefault()
    setPwError('')
    setPwSaved(false)
    if (!pwForm.next || pwForm.next.length < 8) { setPwError('New password must be at least 8 characters.'); return }
    if (pwForm.next !== pwForm.confirm)          { setPwError('Passwords do not match.'); return }
    setPwSaving(true)
    try {
      const { EmailAuthProvider, reauthenticateWithCredential, updatePassword } = await import('firebase/auth')
      const accountEmail = isReceptionist ? (doctor._receptionistEmail ?? doctor.email) : doctor.email
      const cred = EmailAuthProvider.credential(accountEmail, pwForm.current)
      await reauthenticateWithCredential(auth.currentUser, cred)
      await updatePassword(auth.currentUser, pwForm.next)
      setPwForm({ current: '', next: '', confirm: '' })
      setPwSaved(true)
    } catch (err) {
      const code = err?.code ?? ''
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setPwError('Current password is incorrect.')
      } else if (code === 'auth/network-request-failed') {
        setPwError('No internet connection. Please try again.')
      } else if (code === 'auth/too-many-requests') {
        setPwError('Too many attempts. Please wait and try again.')
      } else {
        setPwError('Failed to change password. Please try again.')
      }
    } finally {
      setPwSaving(false)
    }
  }

  // ── Avatar initials ─────────────────────────────────────────────────────────
  const initials = isReceptionist
    ? (doctor?._receptionistName ?? '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'
    : `${doctor?.firstName?.[0] ?? ''}${doctor?.lastName?.[0] ?? ''}`.toUpperCase() || '?'

  const displayName = isReceptionist
    ? doctor?._receptionistName ?? ''
    : `Dr. ${doctor?.firstName ?? ''} ${doctor?.lastName ?? ''}`.trim()

  return (
    <AppLayout title="My Profile">
      <div className="max-w-2xl space-y-8">

        {/* ── Profile hero ───────────────────────────────────────────────────── */}
        <div className="bg-gradient-to-br from-primary-600 to-primary-800 rounded-2xl p-6 flex items-center gap-5 relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-8 -right-8 w-40 h-40 bg-white/5 rounded-full blur-2xl" />
            <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
          </div>
          {/* Avatar / logo */}
          <div className="relative flex-shrink-0">
            {doctor?.logoUrl ? (
              <div className="w-16 h-16 rounded-2xl bg-white shadow-lg flex items-center justify-center overflow-hidden p-1.5">
                <img src={doctor.logoUrl} alt="Clinic logo" className="w-full h-full object-contain" />
              </div>
            ) : (
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
                <span className="text-white font-bold text-xl">{initials}</span>
              </div>
            )}
          </div>
          <div className="relative">
            <p className="text-white font-bold text-lg leading-tight">{displayName}</p>
            {doctor?.clinicName && (
              <p className="text-primary-200 text-sm mt-0.5">{doctor.clinicName}</p>
            )}
            {!isReceptionist && doctor?.specialization && (
              <span className="inline-block mt-2 text-xs font-semibold bg-white/15 text-white px-2.5 py-0.5 rounded-full capitalize">
                {doctor.specialization.replace(/_/g, ' ')}
              </span>
            )}
            {isReceptionist && (
              <span className="inline-block mt-2 text-xs font-semibold bg-white/15 text-white px-2.5 py-0.5 rounded-full">
                Receptionist
              </span>
            )}
          </div>
        </div>

        {/* ── Clinic & Profile ───────────────────────────────────────────────── */}
        <form onSubmit={handleSave} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
            <h2 className="font-semibold text-gray-900 dark:text-white">Clinic &amp; Profile</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">This information appears on your dashboard, invoices, and booking page.</p>
          </div>

          <div className="p-6 space-y-5">

            {/* Clinic logo — doctors only */}
            {!isReceptionist && (
              <div>
                <label className="form-label">Clinic Logo</label>
                <div className="flex items-start gap-4">
                  <div className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-600 flex items-center justify-center bg-gray-50 dark:bg-gray-700/50 overflow-hidden flex-shrink-0">
                    {doctor?.logoUrl ? (
                      <img src={doctor.logoUrl} alt="Clinic logo" className="w-full h-full object-contain p-1" />
                    ) : (
                      <svg className="w-8 h-8 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1">
                    <label className={`cursor-pointer inline-flex items-center gap-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors ${logoUploading ? 'opacity-60 cursor-not-allowed pointer-events-none' : ''}`}>
                      {logoUploading ? (
                        <>
                          <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                          </svg>
                          Uploading…
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
                          </svg>
                          {doctor?.logoUrl ? 'Replace Logo' : 'Upload Logo'}
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/svg+xml,image/png"
                        className="hidden"
                        onChange={handleLogoUpload}
                        disabled={logoUploading}
                      />
                    </label>
                    {doctor?.logoUrl && !logoUploading && (
                      <button
                        type="button"
                        onClick={handleLogoRemove}
                        className="mt-2 block text-xs text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors"
                      >
                        Remove logo
                      </button>
                    )}
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                      SVG or PNG · Max 2 MB · Shown on your patient booking page.
                    </p>
                    {logoError && <p className="text-xs text-red-500 dark:text-red-400 mt-1">{logoError}</p>}
                  </div>
                </div>
              </div>
            )}

            {/* Clinic name — doctors only */}
            {!isReceptionist && (
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
            )}

            {/* Name row */}
            {isReceptionist ? (
              <div>
                <label className="form-label">Full Name</label>
                <input type="text" name="recName" value={form.recName} onChange={handleChange} className="input-field" />
              </div>
            ) : (
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
            )}

            {/* Email — read only */}
            <div>
              <label className="form-label">Email Address</label>
              <input
                type="email"
                value={(isReceptionist ? doctor?._receptionistEmail : doctor?.email) ?? ''}
                readOnly
                className="input-field bg-gray-50 dark:bg-gray-700/50 text-gray-400 dark:text-gray-500 cursor-not-allowed"
              />
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Email cannot be changed.</p>
            </div>

            {/* Phone + Specialization — doctors only */}
            {!isReceptionist && (
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
            )}

            {/* License number — doctors only */}
            {!isReceptionist && (
              <div>
                <label className="form-label">License Number</label>
                <input type="text" name="licenseNumber" value={form.licenseNumber} onChange={handleChange} placeholder="MED-123456" className="input-field" />
              </div>
            )}

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

        {/* ── Change Password ─────────────────────────────────────────────────── */}
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

      </div>
    </AppLayout>
  )
}
