'use client'
import { useState, useEffect, useCallback } from 'react'
import { visitService } from '@/services/visitService'
import { dataStore } from '@/lib/dataStore'
import { useAuth } from '@/context/AuthContext'

export function useVisits(patientId) {
  const { doctor } = useAuth()
  const [visits, setVisits]   = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!doctor || !patientId) return
    setLoading(true)
    const unsub = dataStore.subscribe(`patients/${patientId}/visits`, (data) => {
      setVisits(data.sort((a, b) => new Date(b.visitDate) - new Date(a.visitDate)))
      setLoading(false)
    })
    return () => unsub()
  }, [doctor, patientId])

  const add = useCallback(async (data) => {
    const saved = await visitService.create({ ...data, doctorId: doctor?.id })
    return saved
  }, [doctor])

  const update = useCallback(async (id, patch) => {
    return visitService.update(id, patch, patientId ?? null)
  }, [patientId])

  const remove = useCallback(async (id) => {
    return visitService.remove(id, patientId ?? null)
  }, [patientId])

  return { visits, loading, add, update, remove }
}
