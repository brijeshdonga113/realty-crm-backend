import { useMemo } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getReferralSources } from '@/lib/referralSources'

/**
 * Returns the active referral source list.
 * Uses custom sources from the doctor's profile if set, otherwise defaults.
 */
export function useReferralSources() {
  const { doctor } = useAuth()
  return useMemo(
    () => getReferralSources(doctor?.referralSources),
    [doctor?.referralSources]
  )
}
