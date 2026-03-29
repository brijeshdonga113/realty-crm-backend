'use client'
import { useState, useEffect, useCallback } from 'react'
import { reportService } from '@/services/reportService'
import { useAuth } from '@/context/AuthContext'

export function useReports() {
  const { doctor } = useAuth()
  const [stats, setStats]           = useState(null)
  const [monthlyRevenue, setMonthly] = useState([])
  const [patientGrowth, setGrowth]   = useState([])
  const [loading, setLoading]        = useState(true)

  const load = useCallback(async () => {
    if (!doctor) return
    setLoading(true)
    try {
      const [dashStats, revenue, growth] = await Promise.all([
        reportService.getDashboardStats(),
        reportService.getMonthlyRevenue(6),
        reportService.getPatientGrowth(6),
      ])
      setStats(dashStats)
      setMonthly(revenue)
      setGrowth(growth)
    } finally {
      setLoading(false)
    }
  }, [doctor])

  useEffect(() => { load() }, [load])

  // Reload when user navigates back to the tab/window
  useEffect(() => {
    window.addEventListener('focus', load)
    return () => window.removeEventListener('focus', load)
  }, [load])

  return { stats, monthlyRevenue, patientGrowth, loading, reload: load }
}
