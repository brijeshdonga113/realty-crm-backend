'use client'
import { useState, useEffect, useCallback } from 'react'
import { billingService } from '@/services/billingService'
import { dataStore } from '@/lib/dataStore'
import { useAuth } from '@/context/AuthContext'

export function useBilling() {
  const { doctor } = useAuth()
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)

  useEffect(() => {
    if (!doctor) return
    setLoading(true)
    const unsub = dataStore.subscribe('invoices', (data) => {
      setInvoices(data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)))
      setLoading(false)
      setError(null)
    })
    return () => unsub()
  }, [doctor])

  const add = useCallback(async (data) => {
    return billingService.create({ ...data, doctorId: doctor?.id })
  }, [doctor])

  const update = useCallback(async (id, patch) => {
    return billingService.update(id, patch)
  }, [])

  const markPaid = useCallback(async (id, paymentMethod) => {
    return billingService.markPaid(id, paymentMethod)
  }, [])

  const remove = useCallback(async (id) => {
    return billingService.remove(id)
  }, [])

  return { invoices, loading, error, add, update, markPaid, remove }
}

export function usePatientInvoices(patientId) {
  const { doctor } = useAuth()
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    if (!patientId || !doctor) return
    setLoading(true)
    // Use live subscription so new invoices appear immediately
    const unsub = dataStore.subscribe('invoices', (data) => {
      const filtered = data
        .filter(inv => inv.patientId === patientId)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      setInvoices(filtered)
      setLoading(false)
    })
    return () => unsub()
  }, [patientId, doctor])

  return { invoices, loading }
}
