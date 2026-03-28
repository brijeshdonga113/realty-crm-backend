'use client'
import { useState, useEffect, useCallback } from 'react'
import { notificationService } from '@/services/notificationService'
import { useAuth } from '@/context/AuthContext'

export function useNotifications() {
  const { doctor } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount]     = useState(0)
  const [loading, setLoading]             = useState(true)

  const load = useCallback(async () => {
    if (!doctor) return
    setLoading(true)
    try {
      const all   = await notificationService.getAll()
      const count = all.filter(n => !n.read).length
      setNotifications(all)
      setUnreadCount(count)
    } finally {
      setLoading(false)
    }
  }, [doctor])

  useEffect(() => { load() }, [load])

  const markRead = useCallback(async (id) => {
    await notificationService.markRead(id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    setUnreadCount(prev => Math.max(0, prev - 1))
  }, [])

  const markAllRead = useCallback(async () => {
    await notificationService.markAllRead()
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    setUnreadCount(0)
  }, [])

  const remove = useCallback(async (id) => {
    await notificationService.remove(id)
    setNotifications(prev => {
      const n = prev.find(x => x.id === id)
      if (n && !n.read) setUnreadCount(c => Math.max(0, c - 1))
      return prev.filter(x => x.id !== id)
    })
  }, [])

  return { notifications, unreadCount, loading, markRead, markAllRead, remove, reload: load }
}
