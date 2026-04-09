'use client'
import { useState, useEffect, useCallback } from 'react'
import { followupService } from '@/services/followupService'
import { useAuth } from '@/context/AuthContext'

export function useFollowUps() {
  const { doctor } = useAuth()
  const [followups, setFollowups] = useState([])
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    if (!doctor) return
    setLoading(true)
    const unsub = followupService.subscribe((data) => {
      setFollowups(data)
      setLoading(false)
    })
    return () => unsub()
  }, [doctor])

  const add = useCallback(async (data) => {
    return followupService.create({ ...data, doctorId: doctor?.id })
  }, [doctor])

  const markDone = useCallback(async (id) => {
    const updated = await followupService.markDone(id)
    setFollowups(prev => prev.map(f => f.id === id ? updated : f))
    return updated
  }, [])

  const remove = useCallback(async (id) => {
    await followupService.remove(id)
    setFollowups(prev => prev.filter(f => f.id !== id))
  }, [])

  return { followups, loading, add, markDone, remove }
}
