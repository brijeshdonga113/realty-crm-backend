'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import { SPECIALIZATIONS } from '@/lib/patientIntakePresets'

function friendlyAuthError(err) {
  const code = err?.code ?? ''
  if (code === 'auth/network-request-failed') return 'No internet connection. Please check your network and try again.'
  if (code === 'auth/email-already-in-use') return 'An account with this email already exists. Try signing in instead.'
  if (code === 'auth/invalid-email') return 'Please enter a valid email address.'
  if (code === 'auth/weak-password') return 'Password is too weak. Please use at least 6 characters.'
  if (code === 'auth/too-many-requests') return 'Too many attempts. Please wait a moment and try again.'
  if ((err?.message ?? '').toLowerCase().includes('network')) return 'Network error. Please check your connection and try again.'
  return 'Something went wrong. Please try again.'
}


const initialForm = {
  firstName: '',
  lastName: '',
  email: '',
  specialization: '',
  licenseNumber: '',
  phone: '',
  clinicName: '',
  password: '',
  confirmPassword: '',
}

const LEFT_BENEFITS = [
  { icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z', label: 'Patient records & medical history' },
  { icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', label: 'Appointment scheduling & online booking' },
  { icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', label: 'Invoice & billing generation' },
  { icon: 'M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01', label: 'Visit recording & prescriptions' },
  { icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4', label: 'Inventory & staff management' },
  { icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z', label: 'Secure & private patient data' },
]

function Field({ name, label, type = 'text', placeholder, optional = false, form, errors, onChange, children }) {
  return (
    <div>
      <label className="form-label">
        {label}
        {optional && <span className="text-gray-400 font-normal ml-1">(optional)</span>}
      </label>
      {children || (
        <input
          type={type}
          name={name}
          value={form[name]}
          onChange={onChange}
          placeholder={placeholder}
          className={`input-field ${errors[name] ? 'border-red-400 focus:border-red-400 focus:ring-red-400/10' : ''}`}
        />
      )}
      {errors[name] && <p className="error-text">{errors[name]}</p>}
    </div>
  )
}

export default function SignupPage() {
  const { signup } = useAuth()
  const router = useRouter()

  const [form, setForm] = useState(initialForm)
  const [errors, setErrors] = useState({})
  const [globalError, setGlobalError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
    setErrors(prev => ({ ...prev, [name]: '' }))
    setGlobalError('')
  }

  const validate = () => {
    const errs = {}
    if (!form.firstName.trim()) errs.firstName = 'Required'
    if (!form.lastName.trim()) errs.lastName = 'Required'
    if (!form.email.trim()) errs.email = 'Required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Invalid email address'
    if (!form.specialization) errs.specialization = 'Please select your specialization'
    if (!form.licenseNumber.trim()) errs.licenseNumber = 'Required'
    if (!form.phone.trim()) errs.phone = 'Required'
    if (!form.password) errs.password = 'Required'
    else if (form.password.length < 8) errs.password = 'Minimum 8 characters'
    if (!form.confirmPassword) errs.confirmPassword = 'Required'
    else if (form.password !== form.confirmPassword) errs.confirmPassword = 'Passwords do not match'
    return errs
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    setLoading(true)
    try {
      await signup(form)
      router.push('/dashboard')
    } catch (err) {
      setGlobalError(friendlyAuthError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-theme min-h-screen flex">

      {/* ── Left panel — 50% ───────────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900 flex-col p-12 gap-8 relative overflow-y-auto">
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
          <span className="text-white text-xl font-bold">ClinicCRM</span>
        </div>

        {/* Centre content — fills available space, scrolls if needed */}
        <div className="relative flex-1 flex flex-col justify-center min-h-0">
          <div className="inline-flex items-center gap-2 bg-white/15 text-white text-xs font-semibold px-3 py-1.5 rounded-full mb-5 self-start">
            <span className="w-1.5 h-1.5 bg-white rounded-full" />
            7-day free trial — No credit card required
          </div>
          <h1 className="text-3xl font-bold text-white leading-tight mb-3">
            Start managing your<br />clinic today
          </h1>
          <p className="text-primary-200 text-base leading-relaxed mb-6">
            Join 500+ doctors using ClinicCRM to streamline patient care, manage records, and simplify billing.
          </p>

          {/* Benefit list */}
          <ul className="space-y-3 mb-6">
            {LEFT_BENEFITS.map(item => (
              <li key={item.label} className="flex items-center gap-3">
                <div className="w-8 h-8 bg-white/15 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} />
                  </svg>
                </div>
                <span className="text-primary-100 text-sm">{item.label}</span>
              </li>
            ))}
          </ul>

          {/* Stat chips */}
          <div className="flex gap-3 flex-wrap">
            {[{ val: '500+', label: 'Doctors' }, { val: '50k+', label: 'Appointments' }, { val: '4.9★', label: 'Rating' }].map(s => (
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
            "The online booking link is a game-changer. Patients book themselves and I wake up to a full schedule."
          </p>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-white/20 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">AS</div>
            <div>
              <div className="text-white text-xs font-semibold">Dr. Arjun Sharma</div>
              <div className="text-primary-300 text-xs">Dentist, Bangalore</div>
            </div>
          </div>
        </div>

        <p className="relative text-primary-400 text-xs flex-shrink-0">© {new Date().getFullYear()} ClinicCRM.</p>
      </div>

      {/* ── Right panel — 50% (scrollable for long form) ───────────────────── */}
      <div className="w-full lg:w-1/2 min-h-screen flex items-start justify-center p-8 bg-white overflow-y-auto">
        <div className="w-full max-w-lg py-8">

          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-9 h-9 bg-primary-500 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <span className="text-primary-700 text-lg font-bold">ClinicCRM</span>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-1">Create your doctor account</h2>
          <p className="text-gray-500 text-sm mb-8">Fill in your details to get started — it's free.</p>

          {globalError && (
            <div className="mb-5 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
              <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {globalError}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-5">

            {/* Name row */}
            <div className="grid grid-cols-2 gap-4">
              <Field name="firstName" label="First Name" placeholder="John" form={form} errors={errors} onChange={handleChange} />
              <Field name="lastName" label="Last Name" placeholder="Smith" form={form} errors={errors} onChange={handleChange} />
            </div>

            {/* Email */}
            <Field name="email" label="Email Address" type="email" placeholder="doctor@clinic.com" form={form} errors={errors} onChange={handleChange} />

            {/* Specialization */}
            <Field name="specialization" label="Specialization" form={form} errors={errors} onChange={handleChange}>
              <div className="relative">
                <select
                  name="specialization"
                  value={form.specialization}
                  onChange={handleChange}
                  className={`input-field appearance-none pr-9 ${errors.specialization ? 'border-red-400' : ''}`}
                >
                  <option value="">Select your specialization</option>
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
              {errors.specialization && <p className="error-text">{errors.specialization}</p>}
            </Field>

            {/* License + Phone */}
            <div className="grid grid-cols-2 gap-4">
              <Field name="licenseNumber" label="License Number" placeholder="MED-123456" form={form} errors={errors} onChange={handleChange} />
              <Field name="phone" label="Phone Number" placeholder="+91 98765 43210" form={form} errors={errors} onChange={handleChange} />
            </div>

            {/* Clinic name */}
            <Field name="clinicName" label="Clinic / Hospital Name" placeholder="City Medical Center" optional form={form} errors={errors} onChange={handleChange} />

            {/* Password row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="form-label">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={form.password}
                    onChange={handleChange}
                    placeholder="Min. 8 characters"
                    className={`input-field pr-9 ${errors.password ? 'border-red-400' : ''}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d={showPassword
                          ? "M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                          : "M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        } />
                    </svg>
                  </button>
                </div>
                {errors.password && <p className="error-text">{errors.password}</p>}
              </div>
              <div>
                <label className="form-label">Confirm Password</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  value={form.confirmPassword}
                  onChange={handleChange}
                  placeholder="Re-enter password"
                  className={`input-field ${errors.confirmPassword ? 'border-red-400' : ''}`}
                />
                {errors.confirmPassword && <p className="error-text">{errors.confirmPassword}</p>}
              </div>
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
              ) : 'Create Account'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            Already have an account?{' '}
            <Link href="/login" className="text-primary-600 font-medium hover:underline">
              Sign in
            </Link>
          </p>

        </div>
      </div>
    </div>
  )
}
