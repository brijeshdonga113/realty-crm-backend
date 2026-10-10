'use client'
import { useEffect, useState } from 'react'
import { dataStore } from '@/lib/dataStore'
import { useAuth } from '@/context/AuthContext'

export function useWhatsAppThreads() {
  const { doctor } = useAuth()
  const [threads, setThreads] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!doctor) return
    setLoading(true)
    const unsub = dataStore.subscribe('whatsappThreads', (items) => {
      setThreads(items.sort((a, b) => (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? '')))
      setLoading(false)
    })
    return () => unsub()
  }, [doctor])

  return { threads, loading }
}

export function useWhatsAppMessages(phoneKey) {
  const { doctor } = useAuth()
  const [messages, setMessages] = useState([])

  useEffect(() => {
    if (!doctor || !phoneKey) {
      setMessages([])
      return
    }
    const unsub = dataStore.subscribe(`whatsappThreads/${phoneKey}/messages`, (items) => {
      setMessages(items.sort((a, b) => (a.createdAt ?? a.timestamp ?? '').localeCompare(b.createdAt ?? b.timestamp ?? '')))
    })
    return () => unsub()
  }, [doctor, phoneKey])

  return { messages }
}
