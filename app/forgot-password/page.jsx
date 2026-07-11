'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'

function friendlyResetError(err) {
  const code = err?.code ?? ''
  if (code === 'auth/network-request-failed') return 'No internet connection. Please check your network and try again.'
  if (code === 'auth/invalid-email') return 'Please enter a valid email address.'
  if (code === 'auth/too-many-requests') return 'Too many attempts. Please wait a moment and try again.'
  // Deliberately don't distinguish "user-not-found" — avoids leaking which emails have accounts.
  return 'Something went wrong. Please try again.'
}

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuth()

  const [email, setEmail]     = useState('')
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent]       = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email.trim()) { setError('Please enter your email address.'); return }
    setLoading(true)
    setError('')
    try {
      await resetPassword(email.trim())
      setSent(true)
    } catch (err) {
      // Firebase's auth/user-not-found is deliberately treated the same as
      // success in the UI — showing "sent" either way avoids confirming or
      // denying whether an email address has an account.
      if (err?.code === 'auth/user-not-found') {
        setSent(true)
      } else {
        setError(friendlyResetError(err))
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-theme min-h-screen flex items-center justify-center p-8 bg-white">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="flex items-center gap-2 mb-8">
          <div className="w-9 h-9 bg-primary-500 rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <span className="text-primary-700 text-lg font-bold">Cliniwayz</span>
        </div>

        {sent ? (
          <>
            <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-1">Check your email</h2>
            <p className="text-gray-500 text-sm mb-8">
              If an account exists for <span className="font-medium text-gray-700">{email.trim()}</span>, we've sent a link to reset the password.
            </p>
            <Link href="/login" className="text-primary-600 font-medium hover:underline text-sm">
              ← Back to Sign In
            </Link>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-bold text-gray-900 mb-1">Forgot password?</h2>
            <p className="text-gray-500 text-sm mb-8">Enter your email and we'll send you a link to reset it.</p>

            {error && (
              <div className="mb-5 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
                <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError('') }}
                  placeholder="doctor@clinic.com"
                  className="input-field"
                  autoComplete="email"
                  autoFocus
                />
              </div>

              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Sending...
                  </span>
                ) : 'Send Reset Link'}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-gray-500">
              Remembered your password?{' '}
              <Link href="/login" className="text-primary-600 font-medium hover:underline">
                Sign In
              </Link>
            </p>
          </>
        )}

      </div>
    </div>
  )
}
