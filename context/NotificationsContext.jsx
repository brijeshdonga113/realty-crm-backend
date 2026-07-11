'use client'
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { notificationService } from '@/services/notificationService'
import { dataStore } from '@/lib/dataStore'
import { getNotificationMeta, NOTIFICATION_TYPES } from '@/models/Notification'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/components/ui/Toast'

const NotificationsContext = createContext(null)

function toastVariantFor(type) {
  if (type === 'appointment_cancelled' || type === 'invoice_overdue') return 'error'
  if (type === 'invoice_paid') return 'success'
  return 'info'
}

export function NotificationsProvider({ children }) {
  const { doctor } = useAuth()
  const isReceptionist = doctor?._role === 'receptionist'

  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount]     = useState(0)
  const [loading, setLoading]             = useState(true)

  // useToast() returns a fresh object every render — keep it in a ref so it
  // doesn't force the subscription effect below to re-run on every render.
  const toast = useToast()
  const toastRef = useRef(toast)
  toastRef.current = toast

  // Tracks ids already seen so we only alert on notifications that arrive
  // *after* the initial snapshot, not the whole backlog on first load.
  const seenIdsRef = useRef(null)

  useEffect(() => {
    if (!doctor) return
    setLoading(true)
    seenIdsRef.current = null

    const unsub = dataStore.subscribe('notifications', (all) => {
      const sorted = all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      const visible = isReceptionist
        ? sorted.filter(n =>
            (doctor._receptionistUid && n.createdByUid === doctor._receptionistUid) ||
            n.createdByRole === 'patient'
          )
        : sorted

      if (seenIdsRef.current) {
        for (const n of visible) {
          if (seenIdsRef.current.has(n.id)) continue
          // Popup is scoped to brand-new appointments only — visit/billing
          // events and other appointment subtypes (reminder, cancelled)
          // still land in the notification bell, just without a popup.
          if (n.type === NOTIFICATION_TYPES.APPOINTMENT_NEW && !n.read) {
            const meta = getNotificationMeta(n.type)
            toastRef.current.notify(`${meta.icon} ${n.title}`, toastVariantFor(n.type))
          }
        }
      }
      seenIdsRef.current = new Set(visible.map(n => n.id))

      setNotifications(visible)
      setUnreadCount(visible.filter(n => !n.read).length)
      setLoading(false)
    })

    return () => unsub()
  }, [doctor, isReceptionist])

  const markRead = useCallback(async (id) => {
    await notificationService.markRead(id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    setUnreadCount(prev => Math.max(0, prev - 1))
  }, [])

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

  // No-op — notifications now stream live via dataStore.subscribe(); kept so
  // any existing useNotifications().reload() callers don't break.
  const reload = useCallback(async () => {}, [])

  return (
    <NotificationsContext.Provider value={{ notifications, unreadCount, loading, markRead, markAllRead, remove, reload }}>
      {children}
    </NotificationsContext.Provider>
  )
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext)
  if (!ctx) throw new Error('useNotifications must be used inside NotificationsProvider')
  return ctx
}
