'use client'
import { useState, useEffect, useCallback } from 'react'
import { progressNoteService } from '@/services/progressNoteService'
import { dataStore } from '@/lib/dataStore'
import { useAuth } from '@/context/AuthContext'

export function useProgressNotes(patientId) {
  const { doctor } = useAuth()
  const [notes, setNotes]     = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!doctor || !patientId) return
    setLoading(true)
    const unsub = dataStore.subscribe(`patients/${patientId}/progressNotes`, (data) => {
      setNotes(data.sort((a, b) => (b.noteDate ?? '').localeCompare(a.noteDate ?? '')))
      setLoading(false)
    })
    return () => unsub()
  }, [doctor, patientId])

  const add = useCallback(async (data) => {
    return progressNoteService.create({ ...data, doctorId: doctor?.id, patientId })
  }, [doctor, patientId])

  const update = useCallback(async (id, patch) => {
    return progressNoteService.update(id, patch, patientId)
  }, [patientId])

  const remove = useCallback(async (id) => {
    return progressNoteService.remove(id, patientId)
  }, [patientId])

  return { notes, loading, add, update, remove }
}
