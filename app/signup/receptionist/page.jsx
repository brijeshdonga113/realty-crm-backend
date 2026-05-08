'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'

export default function ReceptionistSignupPage() {
  const { signupReceptionist } = useAuth()
  const router = useRouter()

  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '', inviteCode: '' })
  const [errors, setErrors] = useState({})
  const [globalError, setGlobalError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: name === 'inviteCode' ? value.toUpperCase() : value }))
    setErrors(prev => ({ ...prev, [name]: '' }))
    setGlobalError('')
  }

  const validate = () => {
    const errs = {}
    if (!form.name.trim()) errs.name = 'Required'
    if (!form.email.trim()) errs.email = 'Required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Invalid email address'
    if (!form.password) errs.password = 'Required'
    else if (form.password.length < 8) errs.password = 'Minimum 8 characters'
    if (!form.confirmPassword) errs.confirmPassword = 'Required'
    else if (form.password !== form.confirmPassword) errs.confirmPassword = 'Passwords do not match'
    if (!form.inviteCode.trim()) errs.inviteCode = 'Required'
    else if (form.inviteCode.replace(/\s/g, '').length !== 16) errs.inviteCode = 'Invite code must be 16 characters'
    return errs
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setLoading(true)
    try {
      await signupReceptionist(form.name, form.email, form.password, form.inviteCode)
      router.push('/dashboard')
    } catch (err) {
      setGlobalError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">

      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900 flex-col p-12 gap-8 relative overflow-y-auto">
        {/* Decorative blobs */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/5 rounded-full translate-y-1/3 -translate-x-1/4 blur-3xl" />
        </div>

        {/* Logo */}
        <div className="relative flex items-center gap-3 flex-shrink-0">
          <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          </div>
          <span className="text-white text-xl font-bold tracking-tight">ClinicCRM</span>
        </div>

        {/* Centre content */}
        <div className="relative flex-1 flex flex-col justify-center min-h-0">
          <h1 className="text-3xl font-bold text-white leading-tight mb-3">
            Join your clinic<br />as receptionist
          </h1>
          <p className="text-primary-200 text-base leading-relaxed mb-6">
            Use the invite code provided by your doctor to create your receptionist account.
          </p>

          {/* Feature list */}
          <div className="space-y-3 mb-6">
            {[
              { icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', label: 'Schedule & manage appointments' },
              { icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', label: 'Create patient invoices & billing' },
              { icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z', label: 'Send WhatsApp reminders' },
              { icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z', label: 'View & manage patient records' },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-3">
                <div className="w-8 h-8 bg-white/15 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} />
                  </svg>
                </div>
                <span className="text-primary-100 text-sm">{item.label}</span>
              </div>
            ))}
          </div>

          {/* Stat chips */}
          <div className="flex gap-3 flex-wrap">
            {[{ val: '500+', label: 'Clinics' }, { val: '2 min', label: 'Setup time' }, { val: '4.9★', label: 'Rating' }].map(s => (
              <div key={s.label} className="bg-white/10 backdrop-blur rounded-xl px-3 py-2 text-center">
                <div className="text-white font-bold text-sm">{s.val}</div>
                <div className="text-primary-200 text-xs">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Testimonial */}
        <div className="relative bg-white/10 backdrop-blur rounded-2xl p-4 flex-shrink-0">
          <p className="text-primary-100 text-sm italic mb-3">
            "Managing appointments used to take hours. Now it takes minutes."
          </p>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-white/20 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">AS</div>
            <div>
              <div className="text-white text-xs font-semibold">Anjali Sharma</div>
              <div className="text-primary-300 text-xs">Receptionist, Delhi Clinic</div>
            </div>
          </div>
        </div>

        <p className="relative text-primary-400 text-xs flex-shrink-0">© {new Date().getFullYear()} ClinicCRM.</p>
      </div>

      {/* Right panel — form */}
      <div className="w-full lg:w-1/2 flex items-start justify-center p-8 bg-white dark:bg-gray-900 overflow-y-auto">
        <div className="w-full max-w-md py-8">

          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-9 h-9 bg-primary-500 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <span className="text-primary-700 dark:text-primary-400 text-lg font-bold">ClinicCRM</span>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Receptionist Sign Up</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-8">
            Enter your details and the invite code from your doctor.
          </p>

          {globalError && (
            <div className="mb-5 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-400 text-sm flex items-center gap-2">
              <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {globalError}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-5">

            {/* Full Name */}
            <div>
              <label className="form-label">Full Name <span className="text-red-500">*</span></label>
              <input type="text" name="name" value={form.name} onChange={handleChange}
                placeholder="Jane Smith"
                className={`input-field ${errors.name ? 'border-red-400' : ''}`} />
              {errors.name && <p className="error-text">{errors.name}</p>}
            </div>

            {/* Email */}
            <div>
              <label className="form-label">Email Address <span className="text-red-500">*</span></label>
              <input type="email" name="email" value={form.email} onChange={handleChange}
                placeholder="receptionist@clinic.com"
                className={`input-field ${errors.email ? 'border-red-400' : ''}`} />
              {errors.email && <p className="error-text">{errors.email}</p>}
            </div>

            {/* Password */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="form-label">Password <span className="text-red-500">*</span></label>
                <div className="relative">
                  <input type={showPassword ? 'text' : 'password'} name="password"
                    value={form.password} onChange={handleChange}
                    placeholder="Min. 8 characters"
                    className={`input-field pr-9 ${errors.password ? 'border-red-400' : ''}`} />
                  <button type="button" onClick={() => setShowPassword(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d={showPassword
                          ? "M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                          : "M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"} />
                    </svg>
                  </button>
                </div>
                {errors.password && <p className="error-text">{errors.password}</p>}
              </div>
              <div>
                <label className="form-label">Confirm Password <span className="text-red-500">*</span></label>
                <input type={showPassword ? 'text' : 'password'} name="confirmPassword"
                  value={form.confirmPassword} onChange={handleChange}
                  placeholder="Re-enter password"
                  className={`input-field ${errors.confirmPassword ? 'border-red-400' : ''}`} />
                {errors.confirmPassword && <p className="error-text">{errors.confirmPassword}</p>}
              </div>
            </div>

            {/* Invite Code */}
            <div>
              <label className="form-label">Doctor's Invite Code <span className="text-red-500">*</span></label>
              <input type="text" name="inviteCode" value={form.inviteCode} onChange={handleChange}
                placeholder="16-character code from your doctor"
                maxLength={16}
                className={`input-field font-mono tracking-widest uppercase ${errors.inviteCode ? 'border-red-400' : ''}`} />
              {errors.inviteCode
                ? <p className="error-text">{errors.inviteCode}</p>
                : <p className="text-xs text-gray-400 mt-1">Ask your doctor to share their invite code from Settings.</p>
              }
            </div>

            <button type="submit" className="btn-primary mt-2" disabled={loading}>
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Creating account...
                </span>
              ) : 'Create Receptionist Account'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
            Already have an account?{' '}
            <Link href="/login" className="text-primary-600 dark:text-primary-400 font-medium hover:underline">
              Sign in
            </Link>
          </p>
          <p className="mt-2 text-center text-sm text-gray-500 dark:text-gray-400">
            Are you a doctor?{' '}
            <Link href="/signup" className="text-primary-600 dark:text-primary-400 font-medium hover:underline">
              Create a doctor account
            </Link>
          </p>

        </div>
      </div>
    </div>
  )
}
