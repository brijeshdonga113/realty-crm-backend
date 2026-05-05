import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/context/AuthContext'
import { chatService } from '@/services/chatService'

const INITIAL_LOAD = 20
const PAGE_SIZE    = 30

export function useChat() {
  const { doctor, isReceptionist } = useAuth()
  const [messages,     setMessages]     = useState([])
  const [loadingMore,  setLoadingMore]  = useState(false)
  const [hasMore,      setHasMore]      = useState(true)
  const initialised = useRef(false)

  const role       = isReceptionist ? 'receptionist' : 'doctor'
  const readField  = role === 'doctor' ? 'readByDoctor' : 'readByReceptionist'

  useEffect(() => {
    if (!doctor) return
    initialised.current = false

    const unsub = chatService.subscribeRecent(INITIAL_LOAD, recent => {
      if (!initialised.current) {
        // First fire — set hasMore only if we got a full page
        setHasMore(recent.length === INITIAL_LOAD)
        initialised.current = true
      }
      setMessages(prev => {
        // Merge: keep any older messages already loaded, update/add recent ones
        const recentIds = new Set(recent.map(m => m.id))
        const older = prev.filter(m => !recentIds.has(m.id))
        return [...older, ...recent]
      })
    })
    return () => { unsub(); initialised.current = false }
  }, [doctor])

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !messages.length) return
    setLoadingMore(true)
    try {
      const oldest = messages[0]
      const older  = await chatService.loadBefore(oldest.createdAt, PAGE_SIZE)
      setHasMore(older.length === PAGE_SIZE)
      setMessages(prev => {
        const existingIds = new Set(prev.map(m => m.id))
        const fresh = older.filter(m => !existingIds.has(m.id))
        return [...fresh, ...prev]
      })
    } finally {
      setLoadingMore(false)
    }
  }, [messages, loadingMore, hasMore])

  const unreadCount = messages.filter(m => m.senderRole !== role && !m[readField]).length

  const send = useCallback(async (text) => {
    if (!doctor || !text.trim()) return
    return chatService.send({
      text,
      senderId:   isReceptionist ? (doctor._receptionistUid ?? '') : (doctor.id ?? ''),
      senderName: isReceptionist
        ? (doctor._receptionistName ?? 'Receptionist')
        : `Dr. ${doctor.firstName ?? ''} ${doctor.lastName ?? ''}`.trim(),
      senderRole: role,
    })
  }, [doctor, isReceptionist, role])

  const markRead = useCallback(() => {
    const unread = messages.filter(m => m.senderRole !== role && !m[readField])
    if (unread.length) chatService.markRead(unread.map(m => m.id), role)
  }, [messages, role, readField])

  return { messages, unreadCount, loadMore, loadingMore, hasMore, send, markRead }
}
