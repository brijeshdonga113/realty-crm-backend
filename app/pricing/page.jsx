'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useSubscription } from '@/hooks/useSubscription'
import { AppLayout } from '@/components/layout/AppLayout'

const FEATURES = [
  'Unlimited patient records',
  'Appointment scheduling & calendar',
  'Visit records & prescriptions',
  'Invoice & billing generation',
  'Follow-up reminders',
  'WhatsApp messaging',
  'Google Calendar sync',
  'Reports & analytics',
  'Dark mode & themes',
]

function loadRazorpay() {
  return new Promise(resolve => {
    if (window.Razorpay) { resolve(true); return }
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload  = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
}

export default function PricingPage() {
  const router = useRouter()
  const { doctor, updateProfile } = useAuth()
  const { status, trialDaysRemaining, plan: currentPlan, razorpaySubscriptionId } = useSubscription()

  const [loading, setLoading]   = useState(null) // 'monthly' | 'yearly'
  const [error, setError]       = useState('')

  const handleSubscribe = async (plan) => {
    setLoading(plan)
    setError('')
    try {
      const loaded = await loadRazorpay()
      if (!loaded) throw new Error('Failed to load Razorpay. Check your internet connection.')

      const res = await fetch('/api/razorpay/create-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan,
          doctorId:    doctor.id,
          doctorEmail: doctor.email,
          doctorName:  `${doctor.firstName} ${doctor.lastName}`.trim(),
        }),
      })
      const { subscriptionId, error: apiErr } = await res.json()
      if (apiErr) throw new Error(apiErr)

      const options = {
        key:             process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        subscription_id: subscriptionId,
        name:            'ClinicCRM',
        description:     plan === 'yearly' ? 'Yearly Plan — ₹5,000/year' : 'Monthly Plan — ₹600/month',
        prefill: {
          name:  `${doctor.firstName} ${doctor.lastName}`.trim(),
          email: doctor.email,
        },
        theme: { color: '#6366f1' },
        handler: async (response) => {
          const verifyRes = await fetch('/api/razorpay/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpay_payment_id:      response.razorpay_payment_id,
              razorpay_subscription_id: response.razorpay_subscription_id,
              razorpay_signature:       response.razorpay_signature,
              plan,
              doctorId: doctor.id,
            }),
          })
          const { success, error: vErr } = await verifyRes.json()
          if (!success) throw new Error(vErr || 'Payment verification failed')

          // Optimistically update local state
          await updateProfile({
            subscription: {
              status: 'active',
              plan,
              trialEndsAt: null,
              currentPeriodEnd: null,
              razorpaySubscriptionId: response.razorpay_subscription_id,
            },
          })
          router.push('/dashboard')
        },
      }

      const rzp = new window.Razorpay(options)
      rzp.on('payment.failed', (r) => {
        setError(r.error?.description || 'Payment failed. Please try again.')
        setLoading(null)
      })
      rzp.open()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(null)
    }
  }

  const handleCancelSubscription = async () => {
    if (!window.confirm('Cancel your subscription? You will retain access until the current billing period ends.')) return
    setLoading('cancel')
    setError('')
    try {
      const auth = btoa(`${process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID}:`)
      // Note: cancellation is handled via Razorpay dashboard or customer portal
      // For now, direct users to contact support or Razorpay dashboard
      alert('To cancel, please contact support or manage your subscription from the Razorpay payment dashboard.')
    } finally {
      setLoading(null)
    }
  }

  return (
    <AppLayout title="Subscription">
      <div className="max-w-3xl mx-auto">

        {/* Status banner */}
        {status === 'trial' && (
          <div className="mb-8 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-700 rounded-xl px-6 py-4 flex items-center justify-between">
            <div>
              <p className="font-semibold text-primary-800 dark:text-primary-300">Free Trial Active</p>
              <p className="text-sm text-primary-600 dark:text-primary-400 mt-0.5">
                {trialDaysRemaining > 0 ? `${trialDaysRemaining} day${trialDaysRemaining === 1 ? '' : 's'} remaining` : 'Expires today'}
              </p>
            </div>
            <span className="bg-primary-100 dark:bg-primary-800 text-primary-700 dark:text-primary-300 text-xs font-semibold px-3 py-1 rounded-full">Trial</span>
          </div>
        )}

        {status === 'expired' && (
          <div className="mb-8 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl px-6 py-4">
            <p className="font-semibold text-red-800 dark:text-red-300">Your trial has ended</p>
            <p className="text-sm text-red-600 dark:text-red-400 mt-0.5">Subscribe below to restore full access. Your data is safe.</p>
          </div>
        )}

        {status === 'active' && (
          <div className="mb-8 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-xl px-6 py-4 flex items-center justify-between">
            <div>
              <p className="font-semibold text-green-800 dark:text-green-300">Active Subscription</p>
              <p className="text-sm text-green-600 dark:text-green-400 mt-0.5 capitalize">{currentPlan} plan</p>
            </div>
            <span className="w-2.5 h-2.5 bg-green-500 rounded-full"/>
          </div>
        )}

        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 text-center">Simple, transparent pricing</h2>
        <p className="text-center text-gray-500 dark:text-gray-400 text-sm mb-8">Everything included. No hidden fees.</p>

        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg px-4 py-3 text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Plan cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">

          {/* Monthly */}
          <div className={`bg-white dark:bg-gray-800 rounded-2xl border-2 p-6 flex flex-col ${currentPlan === 'monthly' && status === 'active' ? 'border-primary-500' : 'border-gray-200 dark:border-gray-700'}`}>
            <div className="flex items-center justify-between mb-4">
              <p className="font-semibold text-gray-900 dark:text-white">Monthly</p>
              {currentPlan === 'monthly' && status === 'active' && (
                <span className="text-xs bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 font-semibold px-2.5 py-1 rounded-full">Current plan</span>
              )}
            </div>
            <div className="mb-6">
              <span className="text-4xl font-bold text-gray-900 dark:text-white">₹600</span>
              <span className="text-gray-500 dark:text-gray-400 text-sm ml-1">/month</span>
            </div>
            <ul className="space-y-2.5 flex-1 mb-6">
              {FEATURES.map(f => (
                <li key={f} className="flex items-center gap-2.5 text-sm text-gray-700 dark:text-gray-300">
                  <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
                  </svg>
                  {f}
                </li>
              ))}
            </ul>
            {!(currentPlan === 'monthly' && status === 'active') && (
              <button
                onClick={() => handleSubscribe('monthly')}
                disabled={!!loading}
                className="w-full py-2.5 rounded-xl border-2 border-primary-500 text-primary-600 dark:text-primary-400 font-semibold text-sm hover:bg-primary-50 dark:hover:bg-primary-900/20 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {loading === 'monthly' ? (
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                ) : null}
                {loading === 'monthly' ? 'Processing…' : 'Subscribe Monthly'}
              </button>
            )}
          </div>

          {/* Yearly */}
          <div className={`bg-white dark:bg-gray-800 rounded-2xl border-2 p-6 flex flex-col relative ${currentPlan === 'yearly' && status === 'active' ? 'border-primary-500' : 'border-primary-400'}`}>
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="bg-primary-500 text-white text-xs font-bold px-3 py-1 rounded-full">SAVE ₹2,200</span>
            </div>
            <div className="flex items-center justify-between mb-4">
              <p className="font-semibold text-gray-900 dark:text-white">Yearly</p>
              {currentPlan === 'yearly' && status === 'active' && (
                <span className="text-xs bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 font-semibold px-2.5 py-1 rounded-full">Current plan</span>
              )}
            </div>
            <div className="mb-1">
              <span className="text-4xl font-bold text-gray-900 dark:text-white">₹5,000</span>
              <span className="text-gray-500 dark:text-gray-400 text-sm ml-1">/year</span>
            </div>
            <p className="text-xs text-green-600 dark:text-green-400 font-medium mb-6">≈ ₹417/month — 2 months free</p>
            <ul className="space-y-2.5 flex-1 mb-6">
              {FEATURES.map(f => (
                <li key={f} className="flex items-center gap-2.5 text-sm text-gray-700 dark:text-gray-300">
                  <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
                  </svg>
                  {f}
                </li>
              ))}
            </ul>
            {!(currentPlan === 'yearly' && status === 'active') && (
              <button
                onClick={() => handleSubscribe('yearly')}
                disabled={!!loading}
                className="w-full py-2.5 rounded-xl bg-primary-500 hover:bg-primary-600 text-white font-semibold text-sm disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {loading === 'yearly' ? (
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                ) : null}
                {loading === 'yearly' ? 'Processing…' : 'Subscribe Yearly'}
              </button>
            )}
          </div>

        </div>

        {/* Footer notes */}
        <div className="text-center space-y-1">
          <p className="text-xs text-gray-400 dark:text-gray-500">Payments processed securely by Razorpay. Supports UPI, cards, net banking.</p>
          <p className="text-xs text-gray-400 dark:text-gray-500">Cancel anytime. Your data is never deleted.</p>
          {status === 'active' && razorpaySubscriptionId && (
            <button onClick={handleCancelSubscription} className="text-xs text-red-400 hover:text-red-600 dark:hover:text-red-300 hover:underline mt-2">
              Cancel subscription
            </button>
          )}
        </div>

      </div>
    </AppLayout>
  )
}
