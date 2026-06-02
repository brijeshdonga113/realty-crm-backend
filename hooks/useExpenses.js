'use client'
import { useState, useEffect, useCallback } from 'react'
import { expenseService } from '@/services/expenseService'
import { dataStore } from '@/lib/dataStore'
import { useAuth } from '@/context/AuthContext'

export function useExpenses() {
  const { doctor } = useAuth()
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)

  useEffect(() => {
    if (!doctor) return
    setLoading(true)
    const unsub = dataStore.subscribe('expenses', (data) => {
      setExpenses(data.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')))
      setLoading(false)
      setError(null)
    })
    return () => unsub()
  }, [doctor])

  const add = useCallback(async (data) => {
    return expenseService.create({ ...data, doctorId: doctor?.id })
  }, [doctor])

  const update = useCallback(async (id, patch) => {
    return expenseService.update(id, patch)
  }, [])

  const remove = useCallback(async (id) => {
    return expenseService.remove(id)
  }, [])

  return { expenses, loading, error, add, update, remove }
}
