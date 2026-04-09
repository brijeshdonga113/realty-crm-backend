'use client'
import { useState, useEffect, useCallback } from 'react'
import { patientService } from '@/services/patientService'
import { dataStore } from '@/lib/dataStore'
import { useAuth } from '@/context/AuthContext'

export function usePatients() {
  const { doctor } = useAuth()
  const [patients, setPatients] = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)

  useEffect(() => {
    if (!doctor) return
    setLoading(true)
    const unsub = dataStore.subscribe('patients', (data) => {
      setPatients(data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)))
      setLoading(false)
      setError(null)
    })
    return () => unsub()
  }, [doctor])

  const add = useCallback(async (data) => {
    return patientService.create({ ...data, doctorId: doctor?.id })
  }, [doctor])

  const update = useCallback(async (id, patch) => {
    return patientService.update(id, patch)
  }, [])

  const remove = useCallback(async (id) => {
    return patientService.remove(id)
  }, [])

  const search = useCallback(async (q) => {
    if (!q.trim()) return
    const results = await patientService.search(q)
    setPatients(results)
  }, [])

  return { patients, loading, error, add, update, remove, search }
}

export function usePatient(id) {
  const [patient, setPatient] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    patientService.getById(id)
      .then(p => { setPatient(p); setError(null) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  const update = useCallback(async (patch) => {
    const updated = await patientService.update(id, patch)
    setPatient(updated)
    return updated
  }, [id])

  return { patient, loading, error, update }
}
