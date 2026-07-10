'use client'
import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layout/AppLayout'
import { EmptyState } from '@/components/ui/EmptyState'
import { useWhatsAppMessages } from '@/hooks/useWhatsAppMessages'
import { usePreferences } from '@/hooks/usePreferences'
import { sendWhatsAppMessage } from '@/lib/whatsappApi'
import AutoTextarea from '@/components/ui/AutoTextarea'

function conversationKey(m) {
  return m.patientId || m.contactPhone || m.to || 'unknown'
}

function initials(name) {
  return (name || '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
}

export default function WhatsAppMessagesPage() {
  const router = useRouter()
  const { messages, loading } = useWhatsAppMessages()
  const { formatDate } = usePreferences()
  const [selectedKey, setSelectedKey] = useState(null)
  const [draft, setDraft]             = useState('')
  const [sending, setSending]         = useState(false)
  const [sendError, setSendError]     = useState('')

  // Group messages into one conversation per patient/contact, newest last message first
  const conversations = useMemo(() => {
    const byKey = {}
    messages.forEach(m => {
      const key = conversationKey(m)
      if (!byKey[key]) {
        byKey[key] = {
          key,
          patientId:   m.patientId ?? null,
          patientName: m.patientName || '',
          contactPhone: m.contactPhone || m.to || '',
          messages: [],
        }
      }
      byKey[key].messages.push(m)
      // Prefer a real patient name if any message in the thread has one
      if (m.patientName && !byKey[key].patientName) byKey[key].patientName = m.patientName
    })
    return Object.values(byKey)
      .map(c => ({ ...c, messages: c.messages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)) }))
      .sort((a, b) => {
        const aLast = a.messages[a.messages.length - 1]?.createdAt || ''
        const bLast = b.messages[b.messages.length - 1]?.createdAt || ''
        return bLast.localeCompare(aLast)
      })
  }, [messages])

  const selected = conversations.find(c => c.key === selectedKey) ?? conversations[0] ?? null

  const handleSend = async () => {
    if (!selected || !draft.trim()) return
    setSending(true)
    setSendError('')
    try {
      const result = await sendWhatsAppMessage({
        to:          selected.contactPhone,
        message:     draft.trim(),
        patientId:   selected.patientId,
        patientName: selected.patientName,
        type:        'manual',
      })
      if (result.success) setDraft('')
      else setSendError(result.error)
    } finally {
      setSending(false)
    }
  }

  return (
    <AppLayout title="WhatsApp Messages">
      <div className="h-[calc(100vh-140px)] flex bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">

        {/* Left column — conversations */}
        <div className="w-80 flex-shrink-0 border-r border-gray-100 dark:border-gray-700 flex flex-col">
          <div className="px-4 py-3.5 border-b border-gray-100 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Conversations</h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{conversations.length} contact{conversations.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <p className="text-sm text-gray-400 text-center py-10">Loading…</p>
            ) : conversations.length === 0 ? (
              <EmptyState title="No conversations yet" description="Messages sent or received via the WhatsApp API will show up here."/>
            ) : (
              conversations.map(c => {
                const last = c.messages[c.messages.length - 1]
                return (
                  <div key={c.key} onClick={() => setSelectedKey(c.key)}
                    className={`px-4 py-3 flex items-center gap-3 cursor-pointer border-b border-gray-50 dark:border-gray-700/60 transition-colors
                      ${selected?.key === c.key ? 'bg-primary-50 dark:bg-primary-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/40'}`}>
                    <div className="w-9 h-9 bg-primary-100 dark:bg-primary-900/40 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-primary-700 dark:text-primary-300 font-semibold text-xs">{initials(c.patientName || c.contactPhone)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{c.patientName || c.contactPhone}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {last?.direction === 'outbound' ? 'You: ' : ''}{last?.message}
                      </p>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Right column — thread */}
        <div className="flex-1 flex flex-col min-w-0">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-sm text-gray-400 dark:text-gray-500">
              Select a conversation to view messages.
            </div>
          ) : (
            <>
              <div className="px-5 py-3.5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white text-sm">{selected.patientName || selected.contactPhone}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">{selected.contactPhone}</p>
                </div>
                {selected.patientId && (
                  <button onClick={() => router.push(`/patients/${selected.patientId}`)}
                    className="text-xs text-primary-600 dark:text-primary-400 hover:underline font-medium">
                    View Profile →
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 bg-gray-50/50 dark:bg-gray-900/20">
                {selected.messages.map(m => (
                  <div key={m.id} className={`flex ${m.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${
                      m.direction === 'outbound'
                        ? (m.status === 'failed' ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800' : 'bg-primary-500 text-white')
                        : 'bg-white dark:bg-gray-700 border border-gray-100 dark:border-gray-600'
                    }`}>
                      <p className={`text-sm whitespace-pre-wrap ${m.direction === 'outbound' && m.status !== 'failed' ? 'text-white' : 'text-gray-800 dark:text-gray-100'}`}>
                        {m.message}
                      </p>
                      {m.status === 'failed' && m.error && (
                        <p className="text-xs text-red-600 dark:text-red-400 mt-1">✗ {m.error}</p>
                      )}
                      <p className={`text-[10px] mt-1 ${m.direction === 'outbound' && m.status !== 'failed' ? 'text-primary-100' : 'text-gray-400 dark:text-gray-500'}`}>
                        {formatDate(m.createdAt?.slice(0, 10))} · {new Date(m.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="px-5 py-3.5 border-t border-gray-100 dark:border-gray-700">
                {sendError && <p className="text-xs text-red-500 dark:text-red-400 mb-2">{sendError}</p>}
                <div className="flex items-end gap-2">
                  <AutoTextarea value={draft} onChange={e => setDraft(e.target.value)}
                    placeholder="Type a message… (free text only works within 24h of the patient's last message)"
                    className="input-field flex-1 resize-none" rows={1}/>
                  <button onClick={handleSend} disabled={sending || !draft.trim()}
                    className="px-4 py-2.5 bg-primary-500 hover:bg-primary-600 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors flex-shrink-0">
                    {sending ? 'Sending…' : 'Send'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
