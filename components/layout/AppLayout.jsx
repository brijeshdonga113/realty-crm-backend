'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import Sidebar from '@/components/Sidebar'
import { useNotifications } from '@/hooks/useNotifications'

export function AppLayout({ children, title, action }) {
  const { doctor, loading } = useAuth()
  const router = useRouter()
  const { unreadCount } = useNotifications()

  useEffect(() => {
    if (!loading && !doctor) router.replace('/login')
  }, [doctor, loading, router])

  if (loading || !doctor) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex items-center gap-3 text-gray-400 text-sm">
          <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          Loading...
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar unreadCount={unreadCount} />

      <main className="flex-1 overflow-y-auto flex flex-col">
        {/* Page header */}
        <header className="bg-white border-b border-gray-100 px-8 py-4 flex items-center justify-between sticky top-0 z-10 flex-shrink-0">
          <h1 className="text-xl font-bold text-gray-900">{title}</h1>
          <div className="flex items-center gap-3">
            {action}
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 p-8">
          {children}
        </div>
      </main>
    </div>
  )
}
