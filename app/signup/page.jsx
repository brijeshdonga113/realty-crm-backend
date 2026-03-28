'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'

const SPECIALIZATIONS = [
  { value: 'general', label: 'General Practitioner' },
  { value: 'cardiology', label: 'Cardiology' },
  { value: 'dermatology', label: 'Dermatology' },
  { value: 'neurology', label: 'Neurology' },
  { value: 'orthopedics', label: 'Orthopedics' },
  { value: 'pediatrics', label: 'Pediatrics' },
  { value: 'psychiatry', label: 'Psychiatry' },
  { value: 'gynecology', label: 'Gynecology & Obstetrics' },
  { value: 'ophthalmology', label: 'Ophthalmology' },
  { value: 'ent', label: 'ENT' },
  { value: 'dentistry', label: 'Dentistry' },
  { value: 'other', label: 'Other' },
]

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
      setGlobalError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">

      {/* Left panel */}
      <div className="hidden lg:flex lg:w-2/5 bg-gradient-to-br from-teal-600 via-teal-700 to-blue-800 flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 right-10 w-72 h-72 rounded-full bg-white blur-3xl" />
          <div className="absolute bottom-20 left-5 w-56 h-56 rounded-full bg-teal-300 blur-3xl" />
        </div>

        <div className="relative flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          </div>
          <span className="text-white text-xl font-bold">ClinicCRM</span>
        </div>

        <div className="relative">
          <h1 className="text-3xl font-bold text-white leading-tight mb-4">
            Start managing your<br />clinic today
          </h1>
          <p className="text-teal-100 text-base leading-relaxed mb-8">
            Join thousands of doctors using ClinicCRM to streamline patient care, manage records, and simplify billing.
          </p>
          <ul className="space-y-3">
            {[
              'Patient records & history',
              'Appointment scheduling',
              'Invoice & billing generation',
              'Prescription management',
              'Secure & private data',
            ].map(item => (
              <li key={item} className="flex items-center gap-3 text-teal-100 text-sm">
                <span className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-teal-300 text-sm">© 2026 ClinicCRM.</p>
      </div>

      {/* Right panel — form */}
      <div className="w-full lg:w-3/5 flex items-start justify-center p-8 bg-white overflow-y-auto">
        <div className="w-full max-w-lg py-8">

          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <span className="text-blue-700 text-lg font-bold">ClinicCRM</span>
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
              <Field name="phone" label="Phone Number" placeholder="+1 234 567 8900" form={form} errors={errors} onChange={handleChange} />
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
            <Link href="/login" className="text-blue-600 font-medium hover:underline">
              Sign in
            </Link>
          </p>

        </div>
      </div>
    </div>
  )
}
