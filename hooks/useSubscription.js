import { useAuth } from '@/context/AuthContext'
import { getSubscriptionStatus, canEdit as checkCanEdit, getTrialDaysRemaining } from '@/lib/subscription'

export function useSubscription() {
  const { doctor } = useAuth()
  const status = getSubscriptionStatus(doctor)
  return {
    status,
    isReadOnly:          !checkCanEdit(doctor),
    canEdit:             checkCanEdit(doctor),
    trialDaysRemaining:  getTrialDaysRemaining(doctor),
    plan:                doctor?.subscription?.plan ?? null,
    currentPeriodEnd:    doctor?.subscription?.currentPeriodEnd ?? null,
    razorpaySubscriptionId: doctor?.subscription?.razorpaySubscriptionId ?? null,
  }
}
