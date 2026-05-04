import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/context/AuthContext'
import { chatService } from '@/services/chatService'

export function useChat() {
  const { doctor, isReceptionist } = useAuth()
  const [messages, setMessages] = useState([])

  useEffect(() => {
    if (!doctor) return
    return chatService.subscribe(setMessages)
  }, [doctor])

  const role = isReceptionist ? 'receptionist' : 'doctor'
  const readField = role === 'doctor' ? 'readByDoctor' : 'readByReceptionist'

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

  return { messages, unreadCount, send, markRead }
}
