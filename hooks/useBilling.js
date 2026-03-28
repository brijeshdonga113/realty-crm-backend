'use client'
import { useState, useEffect, useCallback } from 'react'
import { billingService } from '@/services/billingService'
import { useAuth } from '@/context/AuthContext'

export function useBilling() {
  const { doctor } = useAuth()
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)

  const load = useCallback(async () => {
    if (!doctor) return
    setLoading(true)
    try {
      setInvoices(await billingService.getAll())
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [doctor])

  useEffect(() => { load() }, [load])

  const add = useCallback(async (data) => {
    const saved = await billingService.create({ ...data, doctorId: doctor?.id })
    setInvoices(prev => [saved, ...prev])
    return saved
  }, [doctor])

  const update = useCallback(async (id, patch) => {
    const updated = await billingService.update(id, patch)
    setInvoices(prev => prev.map(inv => inv.id === id ? updated : inv))
    return updated
  }, [])

  const markPaid = useCallback(async (id, paymentMethod) => {
    const updated = await billingService.markPaid(id, paymentMethod)
    setInvoices(prev => prev.map(inv => inv.id === id ? updated : inv))
    return updated
  }, [])

  const remove = useCallback(async (id) => {
    await billingService.remove(id)
    setInvoices(prev => prev.filter(inv => inv.id !== id))
  }, [])

  return { invoices, loading, error, add, update, markPaid, remove, reload: load }
}

export function usePatientInvoices(patientId) {
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    if (!patientId) return
    billingService.getForPatient(patientId)
      .then(setInvoices)
      .finally(() => setLoading(false))
  }, [patientId])

  return { invoices, loading }
}
