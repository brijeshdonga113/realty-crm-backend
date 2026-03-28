'use client'
import { useState, useEffect, useCallback } from 'react'
import { visitService } from '@/services/visitService'
import { useAuth } from '@/context/AuthContext'

export function useVisits(patientId) {
  const { doctor } = useAuth()
  const [visits, setVisits]   = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!patientId) return
    setLoading(true)
    const data = patientId
      ? await visitService.getForPatient(patientId)
      : await visitService.getAll()
    setVisits(data)
    setLoading(false)
  }, [patientId])

  useEffect(() => { load() }, [load])

  const add = useCallback(async (data) => {
    const saved = await visitService.create({ ...data, doctorId: doctor?.id })
    setVisits(prev => [saved, ...prev])
    return saved
  }, [doctor])

  const update = useCallback(async (id, patch) => {
    const updated = await visitService.update(id, patch)
    setVisits(prev => prev.map(v => v.id === id ? updated : v))
    return updated
  }, [])

  const remove = useCallback(async (id) => {
    await visitService.remove(id)
    setVisits(prev => prev.filter(v => v.id !== id))
  }, [])

  return { visits, loading, add, update, remove, reload: load }
}
