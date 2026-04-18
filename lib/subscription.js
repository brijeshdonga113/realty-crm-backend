export const PLANS = {
  monthly: { label: 'Monthly', price: 600,  period: 'month', razorpayKey: 'RAZORPAY_MONTHLY_PLAN_ID' },
  yearly:  { label: 'Yearly',  price: 5000, period: 'year',  razorpayKey: 'RAZORPAY_YEARLY_PLAN_ID'  },
}

export const TRIAL_DAYS = 7

export function initTrial() {
  const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 86400000).toISOString()
  return { status: 'trial', plan: null, trialEndsAt, currentPeriodEnd: null, razorpaySubscriptionId: null }
}

export function getSubscriptionStatus(doctor) {
  const sub = doctor?.subscription
  const now = new Date()

  if (!sub) return 'trial' // existing users without subscription field — treat as trial

  if (sub.status === 'active') {
    if (!sub.currentPeriodEnd || new Date(sub.currentPeriodEnd) > now) return 'active'
    return 'expired'
  }

  if (sub.status === 'trial') {
    if (sub.trialEndsAt && new Date(sub.trialEndsAt) > now) return 'trial'
    return 'expired'
  }

  if (sub.status === 'cancelled') {
    if (sub.currentPeriodEnd && new Date(sub.currentPeriodEnd) > now) return 'active'
    return 'expired'
  }

  return 'expired'
}

export function canEdit(doctor) {
  const s = getSubscriptionStatus(doctor)
  return s === 'active' || s === 'trial'
}

export function getTrialDaysRemaining(doctor) {
  const trialEndsAt = doctor?.subscription?.trialEndsAt
  if (!trialEndsAt) return 0
  return Math.max(0, Math.ceil((new Date(trialEndsAt) - new Date()) / 86400000))
}
