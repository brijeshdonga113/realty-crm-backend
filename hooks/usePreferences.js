'use client'
import { useMemo } from 'react'
import { useAuth } from '@/context/AuthContext'
import { formatDate as fmtDate, formatCurrency as fmtCurrency } from '@/lib/preferences'

/**
 * Returns formatDate and formatCurrency bound to the user's saved preferences
 * (dateFormat and currency from their profile). Falls back to DD/MM/YYYY + INR.
 */
export function usePreferences() {
  const { doctor } = useAuth()
  const dateFormat = doctor?.dateFormat ?? 'DD/MM/YYYY'
  const currency   = doctor?.currency   ?? 'INR'

  return useMemo(() => ({
    dateFormat,
    currency,
    formatDate:     (dateStr) => fmtDate(dateStr, dateFormat),
    formatCurrency: (amount)  => fmtCurrency(amount, currency),
  }), [dateFormat, currency])
}
