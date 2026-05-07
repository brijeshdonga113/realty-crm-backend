'use client'
import { useState, useEffect, useCallback } from 'react'
import { notificationService } from '@/services/notificationService'
import { useAuth } from '@/context/AuthContext'

export function useNotifications() {
  const { doctor } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount]     = useState(0)
  const [loading, setLoading]             = useState(true)

  const isReceptionist = doctor?._role === 'receptionist'

  const load = useCallback(async () => {
    if (!doctor) return
    setLoading(true)
    try {
      const all     = await notificationService.getAll()
      // Receptionists see: notifications they triggered + external ones (e.g. patient booking link)
      const visible = isReceptionist
        ? all.filter(n =>
            (doctor._receptionistUid && n.createdByUid === doctor._receptionistUid) ||
            n.createdByRole === 'patient'
          )
        : all
      setNotifications(visible)
      setUnreadCount(visible.filter(n => !n.read).length)
    } finally {
      setLoading(false)
    }
  }, [doctor, isReceptionist])

  useEffect(() => { load() }, [load])

  const markRead = useCallback(async (id) => {
    await notificationService.markRead(id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    setUnreadCount(prev => Math.max(0, prev - 1))
  }, [])

  // Only marks the notifications visible to the current user (safe for both roles)
  const markAllRead = useCallback(async () => {
    const unread = notifications.filter(n => !n.read)
    await Promise.all(unread.map(n => notificationService.markRead(n.id)))
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    setUnreadCount(0)
  }, [notifications])

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
