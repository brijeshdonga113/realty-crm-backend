'use client'
import { useState, useEffect } from 'react'
import { dataStore } from '@/lib/dataStore'
import { useAuth } from '@/context/AuthContext'

export function useWhatsAppMessages() {
  const { doctor } = useAuth()
  const [messages, setMessages] = useState([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    if (!doctor) return
    setLoading(true)
    const unsub = dataStore.subscribe('whatsappMessages', (data) => {
      setMessages(data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)))
      setLoading(false)
    })
    return () => unsub()
  }, [doctor])

  return { messages, loading }
}

export function usePatientWhatsAppMessages(patientId) {
  const { doctor } = useAuth()
  const [messages, setMessages] = useState([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    if (!patientId || !doctor) return
    setLoading(true)
    const unsub = dataStore.subscribe('whatsappMessages', (data) => {
      const filtered = data
        .filter(m => m.patientId === patientId)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      setMessages(filtered)
      setLoading(false)
    })
    return () => unsub()
  }, [patientId, doctor])

  return { messages, loading }
}
