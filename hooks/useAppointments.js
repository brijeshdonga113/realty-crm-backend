'use client'
import { useState, useEffect, useCallback } from 'react'
import { appointmentService } from '@/services/appointmentService'
import { useAuth } from '@/context/AuthContext'

export function useAppointments() {
  const { doctor } = useAuth()
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState(null)

  const load = useCallback(async () => {
    if (!doctor) return
    setLoading(true)
    try {
      setAppointments(await appointmentService.getAll())
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [doctor])

  useEffect(() => { load() }, [load])

  const add = useCallback(async (data) => {
    const saved = await appointmentService.create({ ...data, doctorId: doctor?.id })
    setAppointments(prev => [saved, ...prev])
    return saved
  }, [doctor])

  const update = useCallback(async (id, patch) => {
    const updated = await appointmentService.update(id, patch)
    setAppointments(prev => prev.map(a => a.id === id ? updated : a))
    return updated
  }, [])

  const remove = useCallback(async (id) => {
    await appointmentService.remove(id)
    setAppointments(prev => prev.filter(a => a.id !== id))
  }, [])

  return { appointments, loading, error, add, update, remove, reload: load }
}

export function usePatientAppointments(patientId) {
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading]           = useState(true)

  useEffect(() => {
    if (!patientId) return
    appointmentService.getForPatient(patientId)
      .then(setAppointments)
      .finally(() => setLoading(false))
  }, [patientId])

  return { appointments, loading }
}
