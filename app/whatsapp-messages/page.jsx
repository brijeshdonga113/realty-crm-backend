'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layout/AppLayout'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { useWhatsAppMessages } from '@/hooks/useWhatsAppMessages'
import { usePreferences } from '@/hooks/usePreferences'

function formatTimestamp(iso, formatDate) {
  if (!iso) return '—'
  const time = new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  return `${formatDate(iso.slice(0, 10))} · ${time}`
}

const TYPE_LABELS = {
  appointment_reminder: 'Appointment Reminder',
  followup_reminder:    'Follow-up Reminder',
  test:                 'Test Message',
  manual:               'Manual',
}

const STATUS_OPTS = [
  { value: 'all',    label: 'All' },
  { value: 'sent',   label: 'Sent' },
  { value: 'failed', label: 'Failed' },
]

export default function WhatsAppMessagesPage() {
  const router = useRouter()
  const { messages, loading } = useWhatsAppMessages()
  const { formatDate } = usePreferences()
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterType, setFilterType]     = useState('all')

  const types = ['all', ...new Set(messages.map(m => m.type || 'manual'))]

  const filtered = messages.filter(m => {
    if (filterStatus !== 'all' && m.status !== filterStatus) return false
    if (filterType !== 'all' && (m.type || 'manual') !== filterType) return false
    return true
  })

  const sentCount   = messages.filter(m => m.status === 'sent').length
  const failedCount = messages.filter(m => m.status === 'failed').length

  return (
    <AppLayout title="WhatsApp Messages">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-5">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Total Sent</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{messages.length}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-5">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Delivered to Meta</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{sentCount}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-5">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Failed</p>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">{failedCount}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          {STATUS_OPTS.map(o => (
            <button key={o.value} onClick={() => setFilterStatus(o.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                ${filterStatus === o.value
                  ? 'bg-primary-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
              {o.label}
            </button>
          ))}
          <span className="w-px bg-gray-200 dark:bg-gray-700 mx-1"/>
          {types.map(t => (
            <button key={t} onClick={() => setFilterType(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                ${filterType === t
                  ? 'bg-primary-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
              {t === 'all' ? 'All Types' : (TYPE_LABELS[t] || t)}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
          {loading ? (
            <p className="text-sm text-gray-400 text-center py-10">Loading…</p>
          ) : filtered.length === 0 ? (
            <EmptyState title="No messages yet" description="Messages sent via the WhatsApp API will show up here."/>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-gray-700">
              {filtered.map(m => (
                <div key={m.id}
                  onClick={() => m.patientId && router.push(`/patients/${m.patientId}`)}
                  className={`px-6 py-4 flex items-start gap-4 ${m.patientId ? 'cursor-pointer hover:bg-gray-50/60 dark:hover:bg-gray-700/50' : ''} transition-colors`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {m.patientName || m.to}
                      </p>
                      <Badge label={TYPE_LABELS[m.type] || m.type || 'Manual'} color="blue"/>
                      <Badge label={m.status === 'sent' ? 'Sent' : 'Failed'} color={m.status === 'sent' ? 'green' : 'red'}/>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-300 truncate">{m.message}</p>
                    {m.status === 'failed' && m.error && (
                      <p className="text-xs text-red-500 dark:text-red-400 mt-1">{m.error}</p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-gray-500 dark:text-gray-400">{m.to}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{formatTimestamp(m.createdAt, formatDate)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
