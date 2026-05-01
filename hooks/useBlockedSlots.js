'use client'
import { useState, useEffect, useCallback } from 'react'
import { blockedSlotService } from '@/services/blockedSlotService'
import { useAuth } from '@/context/AuthContext'

export function useBlockedSlots() {
  const { doctor } = useAuth()
  const [blockedSlots, setBlockedSlots] = useState([])

  useEffect(() => {
    if (!doctor) return
    const unsub = blockedSlotService.subscribe(setBlockedSlots)
    return () => unsub()
  }, [doctor])

  const add = useCallback(async (data) => {
    return blockedSlotService.create({ ...data, doctorId: doctor?.id })
  }, [doctor])

  const remove = useCallback(async (id) => {
    return blockedSlotService.remove(id)
  }, [])

  return { blockedSlots, add, remove }
}
