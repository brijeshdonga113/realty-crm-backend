'use client'
import { useState, useEffect, useRef, useLayoutEffect } from 'react'
import { useChat } from '@/hooks/useChat'
import { useAuth } from '@/context/AuthContext'

function formatTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' +
         d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function ChatWidget() {
  const { doctor, isReceptionist } = useAuth()
  const { messages, unreadCount, loadMore, loadingMore, hasMore, send, markRead } = useChat()

  const [open,    setOpen]    = useState(false)
  const [text,    setText]    = useState('')
  const [sending, setSending] = useState(false)

  const listRef      = useRef(null)
  const inputRef     = useRef(null)
  const prevLenRef   = useRef(0)     // track message count to detect prepend vs append
  const scrollBottomRef = useRef(true) // whether we should auto-scroll to bottom

  const role = isReceptionist ? 'receptionist' : 'doctor'

  // When new messages arrive at the bottom, scroll down only if we were already at bottom
  useLayoutEffect(() => {
    const list = listRef.current
    if (!list || !open) return

    const prevLen = prevLenRef.current
    const curLen  = messages.length

    if (curLen > prevLen) {
      const added = curLen - prevLen
      const isAppend = prevLen === 0 || messages[prevLen - 1]?.id !== messages[curLen - added - 1]?.id === false

      if (prevLen === 0 || scrollBottomRef.current) {
        // Initial load or new message at bottom — scroll to bottom
        list.scrollTop = list.scrollHeight
      } else {
        // Prepend (load more) — preserve scroll by adjusting for added height
        const heightBefore = list.scrollHeight
        requestAnimationFrame(() => {
          list.scrollTop = list.scrollHeight - heightBefore
        })
      }
    }
    prevLenRef.current = curLen
  }, [messages, open])

  // Track whether user is near the bottom
  function handleScroll() {
    const list = listRef.current
    if (!list) return
    const nearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 80
    scrollBottomRef.current = nearBottom
  }

  // Mark read + focus input when opened
  useEffect(() => {
    if (open) {
      markRead()
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open, markRead])

  if (!doctor) return null

  async function handleSend(e) {
    e.preventDefault()
    if (!text.trim() || sending) return
    scrollBottomRef.current = true
    setSending(true)
    try {
      await send(text)
      setText('')
    } finally {
      setSending(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend(e)
    }
  }

  return (
    <>
      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-20 right-4 lg:right-6 z-50 w-80 lg:w-96 flex flex-col bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
          style={{ maxHeight: 'calc(100vh - 120px)' }}>

          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 bg-primary-500 text-white flex-shrink-0">
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">
                {isReceptionist
                  ? `Dr. ${doctor.firstName ?? ''} ${doctor.lastName ?? ''}`.trim()
                  : 'Reception'}
              </p>
              <p className="text-xs text-primary-200">Clinic chat</p>
            </div>
            <button onClick={() => setOpen(false)}
              className="p-1 hover:bg-white/20 rounded-lg transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div ref={listRef} onScroll={handleScroll}
            className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0"
            style={{ minHeight: '200px', maxHeight: '420px' }}>

            {/* Load more */}
            {hasMore && (
              <div className="flex justify-center pb-1">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="text-xs font-medium text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/40 disabled:opacity-50 px-3 py-1.5 rounded-full transition-colors flex items-center gap-1.5">
                  {loadingMore ? (
                    <>
                      <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                      Loading…
                    </>
                  ) : (
                    <>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7"/>
                      </svg>
                      Load older messages
                    </>
                  )}
                </button>
              </div>
            )}

            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-10 text-center">
                <div className="w-12 h-12 bg-primary-50 dark:bg-primary-900/30 rounded-full flex items-center justify-center mb-3">
                  <svg className="w-6 h-6 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/>
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No messages yet</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Start the conversation below.</p>
              </div>
            ) : (
              messages.map((msg, i) => {
                const isMine   = msg.senderRole === role
                const showName = i === 0 || messages[i - 1].senderRole !== msg.senderRole
                return (
                  <div key={msg.id} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                    {showName && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mb-1 px-1">{msg.senderName}</p>
                    )}
                    <div className={`max-w-[78%] px-3 py-2 rounded-2xl text-sm leading-relaxed break-words ${
                      isMine
                        ? 'bg-primary-500 text-white rounded-br-sm'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-bl-sm'
                    }`}>
                      {msg.text}
                    </div>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 px-1">
                      {formatTime(msg.createdAt)}
                      {isMine && (
                        <span className="ml-1 opacity-70">
                          {(isReceptionist ? msg.readByDoctor : msg.readByReceptionist) ? '✓✓' : '✓'}
                        </span>
                      )}
                    </p>
                  </div>
                )
              })
            )}
          </div>

          {/* Input */}
          <form onSubmit={handleSend}
            className="flex items-end gap-2 px-3 py-3 border-t border-gray-100 dark:border-gray-700 flex-shrink-0">
            <textarea
              ref={inputRef}
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message… (Enter to send)"
              rows={1}
              className="flex-1 resize-none text-sm bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary-300 dark:focus:ring-primary-600 transition-all"
              style={{ minHeight: '36px', maxHeight: '90px', overflowY: 'auto' }}
              onInput={e => {
                e.target.style.height = 'auto'
                e.target.style.height = Math.min(e.target.scrollHeight, 90) + 'px'
              }}
            />
            <button type="submit" disabled={!text.trim() || sending}
              className="flex-shrink-0 w-9 h-9 bg-primary-500 hover:bg-primary-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl flex items-center justify-center transition-colors">
              {sending ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
                </svg>
              )}
            </button>
          </form>
        </div>
      )}

      {/* Floating toggle button */}
      <button
        onClick={() => setOpen(v => !v)}
        className="fixed bottom-4 right-4 lg:right-6 z-50 w-[52px] h-[52px] bg-primary-500 hover:bg-primary-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all flex items-center justify-center relative">
        {open ? (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/>
          </svg>
        )}
        {!open && unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
    </>
  )
}
