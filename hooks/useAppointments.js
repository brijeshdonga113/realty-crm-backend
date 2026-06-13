'use client'
import { useState, useEffect, useCallback } from 'react'
import { appointmentService } from '@/services/appointmentService'
import { dataStore } from '@/lib/dataStore'
import { useAuth } from '@/context/AuthContext'

export function useAppointments() {
  const { doctor } = useAuth()
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState(null)

  useEffect(() => {
    if (!doctor) return
    setLoading(true)
    const unsub = dataStore.subscribe('appointments', (data) => {
      setAppointments(data.sort((a, b) => {
        const da = new Date(`${a.date}T${a.time || '00:00'}`)
        const db = new Date(`${b.date}T${b.time || '00:00'}`)
        return db - da
      }))
      setLoading(false)
      setError(null)
    })
    return () => unsub()
  }, [doctor])

  const add = useCallback(async (data) => {
    return appointmentService.create({ ...data, doctorId: doctor?.id })
  }, [doctor])

  const update = useCallback(async (id, patch) => {
    return appointmentService.update(id, patch)
  }, [])

  const remove = useCallback(async (id) => {
    return appointmentService.remove(id)
  }, [])

  return { appointments, loading, error, add, update, remove }
}

export function usePatientAppointments(patientId) {
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading]           = useState(true)

  useEffect(() => {
    if (!patientId) return
    setLoading(true)
    // Use real-time subscription so status changes (e.g. completed) reflect immediately
    const unsub = dataStore.subscribe('appointments', (all) => {
      const filtered = all
        .filter(a => a.patientId === patientId)
        .sort((a, b) => {
          const da = new Date(`${a.date}T${a.time || '00:00'}`)
          const db = new Date(`${b.date}T${b.time || '00:00'}`)
          return db - da
        })
      setAppointments(filtered)
      setLoading(false)
    })
    return () => unsub()
  }, [patientId])

  return { appointments, loading }
}
