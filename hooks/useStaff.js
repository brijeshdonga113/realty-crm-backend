'use client'
import { useState, useEffect, useCallback } from 'react'
import { staffService } from '@/services/staffService'
import { useAuth } from '@/context/AuthContext'

export function useStaff() {
  const { doctor } = useAuth()
  const [staff, setStaff]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  const load = useCallback(async () => {
    if (!doctor) return
    setLoading(true)
    try {
      setStaff(await staffService.getAll())
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [doctor])

  useEffect(() => { load() }, [load])

  const add = useCallback(async (data) => {
    const saved = await staffService.create({ ...data, doctorId: doctor?.id })
    setStaff(prev => [saved, ...prev])
    return saved
  }, [doctor])

  const update = useCallback(async (id, patch) => {
    const updated = await staffService.update(id, patch)
    setStaff(prev => prev.map(s => s.id === id ? updated : s))
    return updated
  }, [])

  const remove = useCallback(async (id) => {
    await staffService.remove(id)
    setStaff(prev => prev.filter(s => s.id !== id))
  }, [])

  return { staff, loading, error, add, update, remove, reload: load }
}
