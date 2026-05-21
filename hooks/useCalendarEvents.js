'use client'
import { useState, useEffect, useCallback } from 'react'
import { calendarEventService } from '@/services/calendarEventService'
import { useAuth } from '@/context/AuthContext'

export function useCalendarEvents() {
  const { doctor } = useAuth()
  const [events, setEvents] = useState([])

  useEffect(() => {
    if (!doctor) return
    const unsub = calendarEventService.subscribe(setEvents)
    return () => unsub()
  }, [doctor])

  const add = useCallback(async (data) => {
    return calendarEventService.create({ ...data, doctorId: doctor?.id })
  }, [doctor])

  const remove = useCallback(async (id) => {
    return calendarEventService.remove(id)
  }, [])

  return { events, add, remove }
}
