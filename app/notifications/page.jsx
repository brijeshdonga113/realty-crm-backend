'use client'
import { AppLayout } from '@/components/layout/AppLayout'
import { useNotifications } from '@/hooks/useNotifications'
import { getNotificationMeta } from '@/models/Notification'

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)   return 'Just now'
  if (mins < 60)  return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)   return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

export default function NotificationsPage() {
  const { notifications, loading, markRead, markAllRead, remove } = useNotifications()
  const unread = notifications.filter(n => !n.read)

  return (
    <AppLayout
      title="Notifications"
      action={
        unread.length > 0 ? (
          <button onClick={markAllRead}
            className="text-sm font-medium text-primary-600 hover:underline px-3 py-1.5">
            Mark all as read
          </button>
        ) : null
      }
    >
      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400 text-sm gap-3">
          <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          Loading notifications…
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
            </svg>
          </div>
          <p className="text-sm font-semibold text-gray-600">All caught up!</p>
          <p className="text-xs text-gray-400 mt-1">No notifications yet.</p>
        </div>
      ) : (
        <div className="max-w-2xl mx-auto space-y-1">
          {notifications.map(n => {
            const meta = getNotificationMeta(n.type)
            return (
              <div key={n.id}
                onClick={() => !n.read && markRead(n.id)}
                className={`flex items-start gap-4 p-4 rounded-xl border transition-colors cursor-pointer group
                  ${n.read ? 'bg-white border-gray-100' : 'bg-primary-50 border-primary-100 hover:bg-primary-50/70'}`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-lg
                  ${n.read ? 'bg-gray-100' : 'bg-white shadow-sm'}`}>
                  {meta.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm font-semibold ${n.read ? 'text-gray-700' : 'text-gray-900'}`}>
                      {n.title}
                      {!n.read && <span className="ml-2 inline-block w-2 h-2 bg-accent-500 rounded-full align-middle"/>}
                    </p>
                    <span className="text-xs text-gray-400 flex-shrink-0">{timeAgo(n.createdAt)}</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">{n.body}</p>
                </div>
                <button onClick={e => { e.stopPropagation(); remove(n.id) }}
                  className="text-gray-300 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 p-1 flex-shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>
            )
          })}
        </div>
      )}
    </AppLayout>
  )
}
