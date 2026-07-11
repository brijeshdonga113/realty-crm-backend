'use client'
import { createContext, useContext, useState, useCallback, useEffect } from 'react'

const ToastContext = createContext(null)

let _toastId = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  // Notification popups (new appointment/visit/billing) — anchored above the
  // chat widget, bottom-right, and stay put until the user dismisses them.
  const [notifyToasts, setNotifyToasts] = useState([])

  const show = useCallback((message, type = 'error') => {
    const id = ++_toastId
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }, [])

  const notify = useCallback((message, type = 'info') => {
    const id = ++_toastId
    setNotifyToasts(prev => [...prev, { id, message, type }])
  }, [])

  const dismiss = useCallback((id) => setToasts(prev => prev.filter(t => t.id !== id)), [])
  const dismissNotify = useCallback((id) => setNotifyToasts(prev => prev.filter(t => t.id !== id)), [])

  return (
    <ToastContext.Provider value={{ show, notify }}>
      {children}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none" aria-live="assertive">
        {toasts.map(t => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss}/>
        ))}
      </div>
      <div className="fixed bottom-24 right-4 lg:right-6 z-[9999] flex flex-col-reverse gap-2 pointer-events-none w-80 max-w-[calc(100vw-2rem)]" aria-live="polite">
        {notifyToasts.map(t => (
          <ToastItem key={t.id} toast={t} onDismiss={dismissNotify}/>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastItem({ toast, onDismiss }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const show = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(show)
  }, [])

  const isError   = toast.type === 'error'
  const isSuccess = toast.type === 'success'
  const isInfo    = toast.type === 'info'

  return (
    <div
      className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border max-w-sm transition-all duration-300
        ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}
        ${isError   ? 'bg-red-50 border-red-200 dark:bg-red-900/30 dark:border-red-700' : ''}
        ${isSuccess ? 'bg-green-50 border-green-200 dark:bg-green-900/30 dark:border-green-700' : ''}
        ${isInfo    ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/30 dark:border-blue-700' : ''}
        ${!isError && !isSuccess && !isInfo ? 'bg-gray-800 border-gray-700' : ''}
      `}
    >
      {isError && (
        <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
        </svg>
      )}
      {isSuccess && (
        <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
        </svg>
      )}
      {isInfo && (
        <svg className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/>
        </svg>
      )}
      <p className={`text-sm flex-1 font-medium
        ${isError   ? 'text-red-800 dark:text-red-200'   : ''}
        ${isSuccess ? 'text-green-800 dark:text-green-200' : ''}
        ${isInfo    ? 'text-blue-800 dark:text-blue-200'   : ''}
        ${!isError && !isSuccess && !isInfo ? 'text-white' : ''}
      `}>{toast.message}</p>
      <button
        onClick={() => onDismiss(toast.id)}
        className={`flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity
          ${isError   ? 'text-red-600 dark:text-red-300'   : ''}
          ${isSuccess ? 'text-green-600 dark:text-green-300' : ''}
          ${isInfo    ? 'text-blue-600 dark:text-blue-300'   : ''}
          ${!isError && !isSuccess && !isInfo ? 'text-gray-300' : ''}
        `}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return {
    error:   (msg) => ctx.show(msg, 'error'),
    success: (msg) => ctx.show(msg, 'success'),
    info:    (msg) => ctx.show(msg, 'info'),
    // Persistent popup (e.g. new-notification alerts) — doesn't auto-dismiss,
    // anchored bottom-right above the chat widget instead of top-right.
    notify:  (msg, type = 'info') => ctx.notify(msg, type),
  }
}
