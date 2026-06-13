'use client'
import { useState, useEffect, useCallback } from 'react'
import { leadService } from '@/services/leadService'
import { useAuth } from '@/context/AuthContext'

export function useLeads() {
  const { doctor } = useAuth()
  const [leads, setLeads]     = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!doctor) return
    setLoading(true)
    const unsub = leadService.subscribe((data) => {
      setLeads(data.filter(l => l.status !== 'converted'))
      setLoading(false)
    })
    return () => unsub()
  }, [doctor])

  const add = useCallback(async (data) => {
    return leadService.create(data)
  }, [])

  const convert = useCallback(async (id) => {
    return leadService.convert(id)
  }, [])

  const remove = useCallback(async (id) => {
    return leadService.remove(id)
  }, [])

  return { leads, loading, add, convert, remove }
}
