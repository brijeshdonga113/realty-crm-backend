'use client'

import { useRouter } from 'next/navigation'
import { useSubscription } from '@/hooks/useSubscription'

export function SubscriptionBanner() {
  const router = useRouter()
  const { status, trialDaysRemaining } = useSubscription()

  if (status === 'active') return null

  if (status === 'trial') {
    const urgent = trialDaysRemaining <= 2
    return (
      <div className={`flex items-center justify-between px-4 lg:px-8 py-2 text-sm ${
        urgent
          ? 'bg-orange-50 dark:bg-orange-900/20 border-b border-orange-200 dark:border-orange-700'
          : 'bg-primary-50 dark:bg-primary-900/20 border-b border-primary-100 dark:border-primary-800'
      }`}>
        <p className={urgent ? 'text-orange-700 dark:text-orange-300' : 'text-primary-700 dark:text-primary-300'}>
          {urgent
            ? `⚠️ Trial ends in ${trialDaysRemaining} day${trialDaysRemaining === 1 ? '' : 's'} — subscribe to keep full access.`
            : `Free trial — ${trialDaysRemaining} day${trialDaysRemaining === 1 ? '' : 's'} remaining.`}
        </p>
        <button
          onClick={() => router.push('/pricing')}
          className={`ml-4 text-xs font-semibold px-3 py-1 rounded-full transition-colors flex-shrink-0 ${
            urgent
              ? 'bg-orange-500 hover:bg-orange-600 text-white'
              : 'bg-primary-500 hover:bg-primary-600 text-white'
          }`}
        >
          Upgrade
        </button>
      </div>
    )
  }

  // expired
  return (
    <div className="flex items-center justify-between px-4 lg:px-8 py-2.5 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-700">
      <p className="text-sm text-red-700 dark:text-red-300 font-medium">
        Your trial has ended. The app is in read-only mode — subscribe to add or edit records.
      </p>
      <button
        onClick={() => router.push('/pricing')}
        className="ml-4 text-xs font-semibold px-3 py-1.5 rounded-full bg-red-500 hover:bg-red-600 text-white transition-colors flex-shrink-0"
      >
        Subscribe Now
      </button>
    </div>
  )
}
