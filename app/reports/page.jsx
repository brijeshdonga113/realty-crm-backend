'use client'
import { useState, useMemo } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { useReports, computeRevenueForRange } from '@/hooks/useReports'
import { usePreferences } from '@/hooks/usePreferences'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const today = new Date().toISOString().slice(0, 10)
const firstOfYear = `${new Date().getFullYear()}-01-01`

function periodRange(period) {
  const now = new Date()
  const pad = n => String(n).padStart(2, '0')
  switch (period) {
    case 'this_month': {
      const from = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`
      return { from, to: today }
    }
    case 'last_month': {
      const d = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const last = new Date(now.getFullYear(), now.getMonth(), 0)
      return {
        from: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`,
        to:   `${last.getFullYear()}-${pad(last.getMonth() + 1)}-${pad(last.getDate())}`,
      }
    }
    case '3m': {
      const d = new Date(now); d.setMonth(d.getMonth() - 3)
      return { from: d.toISOString().slice(0, 10), to: today }
    }
    case '6m': {
      const d = new Date(now); d.setMonth(d.getMonth() - 6)
      return { from: d.toISOString().slice(0, 10), to: today }
    }
    case 'this_year':
      return { from: firstOfYear, to: today }
    case 'all':
    default:
      return { from: '2000-01-01', to: today }
  }
}

// ─── Chart components ─────────────────────────────────────────────────────────

function BarChart({ data, valueKey, labelKey, color = 'blue', unit = '', fmtCurrency }) {
  if (!data?.length) return (
    <div className="h-40 flex items-center justify-center text-sm text-gray-400 dark:text-gray-500">No data yet</div>
  )
  const max = Math.max(...data.map(d => d[valueKey]), 1)
  const colors = {
    blue:   { bar: 'bg-primary-500', label: 'text-primary-600 dark:text-primary-400' },
    green:  { bar: 'bg-green-500',   label: 'text-green-600 dark:text-green-400' },
    purple: { bar: 'bg-purple-500',  label: 'text-purple-600 dark:text-purple-400' },
    orange: { bar: 'bg-orange-500',  label: 'text-orange-600 dark:text-orange-400' },
  }
  const c = colors[color] ?? colors.blue
  return (
    <div className="flex items-end gap-1.5 h-40">
      {data.map((item, i) => {
        const h = Math.max((item[valueKey] / max) * 100, 2)
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0">
            <span className={`text-xs font-medium truncate w-full text-center ${c.label}`}>
              {unit === 'currency' && fmtCurrency ? fmtCurrency(item[valueKey]) : item[valueKey]}
            </span>
            <div className={`w-full ${c.bar} rounded-t-lg transition-all`} style={{ height: `${h}%` }}/>
            <span className="text-xs text-gray-400 dark:text-gray-500 truncate w-full text-center">{item[labelKey]}</span>
          </div>
        )
      })}
    </div>
  )
}

const BAR_COLORS = ['bg-primary-500','bg-green-500','bg-orange-500','bg-purple-500','bg-yellow-400','bg-teal-500','bg-red-400','bg-pink-400']

function HorizontalBar({ items, totalKey = 'count', labelKey = 'label' }) {
  if (!items?.length) return <div className="text-sm text-gray-400 dark:text-gray-500">No data yet</div>
  const max = Math.max(...items.map(i => i[totalKey]), 1)
  return (
    <div className="space-y-3">
      {items.map((item, idx) => (
        <div key={item.key ?? idx}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-gray-700 dark:text-gray-300">{item[labelKey]}</span>
            <span className="text-sm font-bold text-gray-900 dark:text-white">{item[totalKey]}</span>
          </div>
          <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
            <div className={`${BAR_COLORS[idx % BAR_COLORS.length]} h-2 rounded-full transition-all`}
              style={{ width: `${(item[totalKey] / max) * 100}%` }}/>
          </div>
        </div>
      ))}
    </div>
  )
}

function StatCard({ label, value, sub, color = 'blue' }) {
  const colors = {
    blue:   'text-primary-600 dark:text-primary-400',
    green:  'text-green-600 dark:text-green-400',
    purple: 'text-purple-600 dark:text-purple-400',
    orange: 'text-orange-600 dark:text-orange-400',
    red:    'text-red-600 dark:text-red-400',
    teal:   'text-teal-600 dark:text-teal-400',
  }
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-5">
      <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{label}</p>
      <p className={`text-3xl font-bold ${colors[color] ?? colors.blue}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{sub}</p>}
    </div>
  )
}

// ─── Period filter bar ────────────────────────────────────────────────────────

const PERIODS = [
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: '3m',         label: '3 Months' },
  { value: '6m',         label: '6 Months' },
  { value: 'this_year',  label: 'This Year' },
  { value: 'all',        label: 'All Time' },
  { value: 'custom',     label: 'Custom' },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const { formatCurrency } = usePreferences()
  const { stats, monthlyRevenue, yearlyRevenue, patientGrowth, referralBreakdown,
          rawInvoices, rawPatients, rawAppointments, rawVisits, loading } = useReports()

  const [period,      setPeriod]      = useState('this_month')
  const [customFrom,  setCustomFrom]  = useState(firstOfYear)
  const [customTo,    setCustomTo]    = useState(today)
  const [revenueView, setRevenueView] = useState('6m')

  // Resolve date range for the active period
  const { from, to } = useMemo(() => {
    return period === 'custom'
      ? { from: customFrom, to: customTo }
      : periodRange(period)
  }, [period, customFrom, customTo])

  // Filtered KPI stats for selected period
  const filteredStats = useMemo(() => {
    if (!rawPatients.length && !rawInvoices.length && !rawAppointments.length && !rawVisits.length) return null
    const inRange = (dateStr) => dateStr >= from && dateStr <= to

    const patients     = rawPatients.filter(p => inRange((p.createdAt ?? '').slice(0, 10)))
    const visits       = rawVisits.filter(v => inRange((v.visitDate ?? '').slice(0, 10)))
    const appointments = rawAppointments.filter(a => inRange(a.date ?? ''))
    const paidInvoices = rawInvoices.filter(i => i.status === 'paid' && inRange(i.issueDate ?? ''))
    const dueInvoices  = rawInvoices.filter(i => ['draft', 'sent'].includes(i.status) && inRange(i.issueDate ?? ''))

    return {
      patients:     patients.length,
      visits:       visits.length,
      revenue:      paidInvoices.reduce((s, i) => s + i.total, 0),
      pending:      dueInvoices.length,
      pendingAmount: dueInvoices.reduce((s, i) => s + i.total, 0),
      appointments: appointments.length,
      completed:    appointments.filter(a => a.status === 'completed').length,
    }
  }, [rawPatients, rawVisits, rawAppointments, rawInvoices, from, to])

  if (loading) return (
    <AppLayout title="Reports & Analytics">
      <div className="flex items-center justify-center py-20 text-gray-400 text-sm gap-3">
        <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
        Loading reports…
      </div>
    </AppLayout>
  )

  return (
    <AppLayout title="Reports & Analytics">
      <div className="space-y-8">

        {/* ── Period filter ────────────────────────────────────────────────── */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Period</span>
            <div className="flex flex-wrap gap-1.5">
              {PERIODS.map(p => (
                <button key={p.value} onClick={() => setPeriod(p.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                    ${period === p.value
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
                  {p.label}
                </button>
              ))}
            </div>
            {period === 'custom' && (
              <div className="flex items-center gap-2 ml-1">
                <input type="date" value={customFrom} max={customTo}
                  onChange={e => setCustomFrom(e.target.value)}
                  className="input-field py-1.5 text-xs w-36"/>
                <span className="text-gray-400 text-xs">to</span>
                <input type="date" value={customTo} min={customFrom} max={today}
                  onChange={e => setCustomTo(e.target.value)}
                  className="input-field py-1.5 text-xs w-36"/>
              </div>
            )}
          </div>
        </div>

        {/* ── Filtered KPI row ─────────────────────────────────────────────── */}
        {filteredStats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="New Patients"     value={filteredStats.patients}                        sub={`registered in period`}           color="blue"/>
            <StatCard label="Visits"           value={filteredStats.visits}                          sub="recorded in period"               color="teal"/>
            <StatCard label="Revenue"          value={formatCurrency(filteredStats.revenue)}         sub="from paid invoices"               color="green"/>
            <StatCard label="Due / Pending"    value={formatCurrency(filteredStats.pendingAmount)}   sub={`${filteredStats.pending} invoices`} color="orange"/>
          </div>
        )}

        {/* ── Revenue chart with toggle ────────────────────────────────────── */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Revenue Overview</h3>
              <p className="text-xs text-gray-400 dark:text-gray-500">Paid invoices only</p>
            </div>
            <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-lg w-fit">
              {[['6m','6 Months'],['12m','12 Months']].map(([v, l]) => (
                <button key={v} onClick={() => setRevenueView(v)}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors
                    ${revenueView === v ? 'bg-white dark:bg-gray-600 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          <BarChart data={revenueView === '12m' ? yearlyRevenue : monthlyRevenue}
            valueKey="revenue" labelKey="label" color="green" unit="currency" fmtCurrency={formatCurrency}/>
        </div>

        {/* ── Patient Growth ───────────────────────────────────────────────── */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Patient Registrations</h3>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-5">New patients per month (last 6 months)</p>
          <BarChart data={patientGrowth} valueKey="count" labelKey="label" color="blue"/>
        </div>

        {/* ── Referral breakdown + Appointment breakdown ───────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Patient Sources</h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-5">Where your patients are coming from</p>
            <HorizontalBar items={referralBreakdown} totalKey="count" labelKey="label"/>
          </div>

          {stats && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Appointment Breakdown</h3>
              <div className="space-y-3">
                {[
                  { label: 'Scheduled',  value: stats.appointments.upcomingCount,  color: 'bg-primary-500' },
                  { label: 'Completed',  value: stats.appointments.completedCount, color: 'bg-green-500' },
                  { label: 'No Shows',   value: stats.appointments.noShowCount,    color: 'bg-yellow-400' },
                  { label: 'Total',      value: stats.appointments.total,          color: 'bg-gray-300 dark:bg-gray-500' },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-3">
                    <span className={`w-3 h-3 rounded-full ${item.color} flex-shrink-0`}/>
                    <span className="text-sm text-gray-600 dark:text-gray-300 flex-1">{item.label}</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">{item.value}</span>
                  </div>
                ))}
                {stats.appointments.total > 0 && (
                  <div className="mt-2">
                    <div className="text-xs text-gray-400 dark:text-gray-500 mb-1.5">
                      No-show rate: {((stats.appointments.noShowCount / stats.appointments.total) * 100).toFixed(1)}%
                    </div>
                    <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                      <div className="bg-yellow-400 h-2 rounded-full transition-all"
                        style={{ width: `${(stats.appointments.noShowCount / stats.appointments.total) * 100}%` }}/>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Patient Analytics + Billing Summary ─────────────────────────── */}
        {stats && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Patient Analytics</h3>
              <div className="space-y-3">
                {[
                  { label: 'Total Registered',     value: stats.patients.total,           color: 'bg-primary-500' },
                  { label: 'Active Patients',       value: stats.patients.active,          color: 'bg-green-500' },
                  { label: 'Registered This Month', value: stats.patients.thisMonth,       color: 'bg-teal-500' },
                  { label: 'Follow-ups Scheduled',  value: stats.followups.total,          color: 'bg-orange-400' },
                  { label: 'Follow-ups Overdue',    value: stats.followups.overdueCount,   color: 'bg-red-500' },
                  { label: 'Appointments No-Show',  value: stats.appointments.noShowCount, color: 'bg-yellow-400' },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-3">
                    <span className={`w-3 h-3 rounded-full ${item.color} flex-shrink-0`}/>
                    <span className="text-sm text-gray-600 dark:text-gray-300 flex-1">{item.label}</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Billing Summary</h3>
              <div className="space-y-3">
                {[
                  { label: 'Paid Invoices',    value: stats.billing.paid,    amount: stats.billing.totalRevenue,  color: 'bg-green-500' },
                  { label: 'Due / Pending',    value: stats.billing.pending, amount: stats.billing.pendingAmount, color: 'bg-orange-400' },
                  { label: 'Overdue',          value: stats.billing.overdue, amount: 0,                           color: 'bg-red-500' },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-3">
                    <span className={`w-3 h-3 rounded-full ${item.color} flex-shrink-0`}/>
                    <span className="text-sm text-gray-600 dark:text-gray-300 flex-1">{item.label}</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                      {item.value}{item.amount > 0 ? ` · ${formatCurrency(item.amount)}` : ''}
                    </span>
                  </div>
                ))}
                <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Total invoices: <span className="font-semibold text-gray-800 dark:text-gray-200">{stats.billing.total}</span>
                    &nbsp;·&nbsp;Today's revenue: <span className="font-semibold text-green-700 dark:text-green-400">{formatCurrency(stats.billing.todayRevenue)}</span>
                  </p>
                </div>
              </div>
            </div>

          </div>
        )}

      </div>
    </AppLayout>
  )
}
