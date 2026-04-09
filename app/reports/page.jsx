'use client'
import { useState, useMemo } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { useReports, computeRevenueForRange } from '@/hooks/useReports'
import { formatCurrency } from '@/models/Invoice'

// ─── Chart components ─────────────────────────────────────────────────────────

function BarChart({ data, valueKey, labelKey, color = 'blue', unit = '' }) {
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
              {unit === 'currency' ? formatCurrency(item[valueKey]) : item[valueKey]}
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

// ─── Page ─────────────────────────────────────────────────────────────────────

const today = new Date().toISOString().slice(0, 10)
const firstOfYear = `${new Date().getFullYear()}-01-01`

export default function ReportsPage() {
  const { stats, monthlyRevenue, yearlyRevenue, patientGrowth, referralBreakdown, rawInvoices, loading } = useReports()

  const [revenueView, setRevenueView]   = useState('6m') // '6m' | '12m' | 'custom'
  const [customFrom,  setCustomFrom]    = useState(firstOfYear)
  const [customTo,    setCustomTo]      = useState(today)

  const customRevenue = useMemo(() => {
    if (!rawInvoices?.length || !customFrom || !customTo) return 0
    return computeRevenueForRange(rawInvoices, customFrom, customTo)
  }, [rawInvoices, customFrom, customTo])

  const revenueData = revenueView === '12m' ? yearlyRevenue : monthlyRevenue

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

        {/* ── KPI row ─────────────────────────────────────────────────────── */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total Patients"     value={stats.patients.total}                        sub={`${stats.patients.thisMonth} this month`}    color="blue"/>
            <StatCard label="Total Visits"        value={stats.visits.todayCount}                     sub="today"                                        color="teal"/>
            <StatCard label="Total Revenue"       value={formatCurrency(stats.billing.totalRevenue)}  sub="from paid invoices"                           color="green"/>
            <StatCard label="Pending Payments"    value={formatCurrency(stats.billing.pendingAmount)} sub={`${stats.billing.pending} invoices`}          color="orange"/>
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
              {[['6m','6 Months'],['12m','12 Months'],['custom','Custom']].map(([v, l]) => (
                <button key={v} onClick={() => setRevenueView(v)}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors
                    ${revenueView === v ? 'bg-white dark:bg-gray-600 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          {revenueView === 'custom' ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-end gap-4">
                <div>
                  <label className="form-label">From</label>
                  <input type="date" value={customFrom} max={customTo}
                    onChange={e => setCustomFrom(e.target.value)} className="input-field w-40"/>
                </div>
                <div>
                  <label className="form-label">To</label>
                  <input type="date" value={customTo} min={customFrom} max={today}
                    onChange={e => setCustomTo(e.target.value)} className="input-field w-40"/>
                </div>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 rounded-xl p-5 text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                  Revenue from {customFrom} to {customTo}
                </p>
                <p className="text-4xl font-bold text-green-600 dark:text-green-400">{formatCurrency(customRevenue)}</p>
              </div>
            </div>
          ) : (
            <BarChart data={revenueData} valueKey="revenue" labelKey="label" color="green" unit="currency"/>
          )}
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
                  { label: 'Total Registered',     value: stats.patients.total,                 color: 'bg-primary-500' },
                  { label: 'Active Patients',       value: stats.patients.active,                color: 'bg-green-500' },
                  { label: 'Registered This Month', value: stats.patients.thisMonth,             color: 'bg-teal-500' },
                  { label: 'Follow-ups Scheduled',  value: stats.followups.total,                color: 'bg-orange-400' },
                  { label: 'Follow-ups Overdue',    value: stats.followups.overdueCount,         color: 'bg-red-500' },
                  { label: 'Appointments No-Show',  value: stats.appointments.noShowCount,       color: 'bg-yellow-400' },
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
                  { label: 'Pending Invoices', value: stats.billing.pending, amount: stats.billing.pendingAmount, color: 'bg-primary-500' },
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
