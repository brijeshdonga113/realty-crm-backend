'use client'
import { useState, useEffect, useCallback } from 'react'
import { patientService } from '@/services/patientService'
import { useAuth } from '@/context/AuthContext'

export function usePatients() {
  const { doctor } = useAuth()
  const [patients, setPatients] = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)

  const load = useCallback(async () => {
    if (!doctor) return
    setLoading(true)
    try {
      setPatients(await patientService.getAll())
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [doctor])

  useEffect(() => { load() }, [load])

  const add = useCallback(async (data) => {
    const saved = await patientService.create({ ...data, doctorId: doctor?.id })
    setPatients(prev => [saved, ...prev])
    return saved
  }, [doctor])

  const update = useCallback(async (id, patch) => {
    const updated = await patientService.update(id, patch)
    setPatients(prev => prev.map(p => p.id === id ? updated : p))
    return updated
  }, [])

  const remove = useCallback(async (id) => {
    await patientService.remove(id)
    setPatients(prev => prev.filter(p => p.id !== id))
  }, [])

  const search = useCallback(async (query) => {
    if (!query.trim()) return load()
    const results = await patientService.search(query)
    setPatients(results)
  }, [load])

  return { patients, loading, error, add, update, remove, search, reload: load }
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
