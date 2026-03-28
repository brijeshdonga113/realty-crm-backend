'use client'
import { AppLayout } from '@/components/layout/AppLayout'
import { useReports } from '@/hooks/useReports'
import { formatCurrency } from '@/models/Invoice'

function BarChart({ data, valueKey, labelKey, color = 'blue', unit = '' }) {
  const max = Math.max(...data.map(d => d[valueKey]), 1)
  const colors = {
    blue:   { bar: 'bg-blue-500', label: 'text-blue-600' },
    green:  { bar: 'bg-green-500', label: 'text-green-600' },
    purple: { bar: 'bg-purple-500', label: 'text-purple-600' },
  }
  const c = colors[color] ?? colors.blue

  return (
    <div className="flex items-end gap-2 h-40">
      {data.map((item, i) => {
        const h = Math.max((item[valueKey] / max) * 100, 2)
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <span className={`text-xs font-medium ${c.label}`}>
              {unit === 'currency' ? formatCurrency(item[valueKey]) : item[valueKey]}
            </span>
            <div className={`w-full ${c.bar} rounded-t-lg transition-all`} style={{ height: `${h}%` }}/>
            <span className="text-xs text-gray-400 truncate w-full text-center">{item[labelKey]}</span>
          </div>
        )
      })}
    </div>
  )
}

function StatCard({ label, value, sub, color = 'blue' }) {
  const colors = { blue: 'text-blue-600', green: 'text-green-600', purple: 'text-purple-600', orange: 'text-orange-600', red: 'text-red-600' }
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <p className="text-sm font-medium text-gray-500 mb-1">{label}</p>
      <p className={`text-3xl font-bold ${colors[color] ?? colors.blue}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

export default function ReportsPage() {
  const { stats, monthlyRevenue, patientGrowth, loading } = useReports()

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

        {/* KPI row */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total Patients" value={stats.patients.total} sub={`${stats.patients.thisMonth} this month`} color="blue"/>
            <StatCard label="Total Appointments" value={stats.appointments.total} sub={`${stats.appointments.todayCount} today`} color="green"/>
            <StatCard label="Total Revenue" value={formatCurrency(stats.billing.totalRevenue)} sub="from paid invoices" color="purple"/>
            <StatCard label="Pending Payments" value={formatCurrency(stats.billing.pendingAmount)} sub={`${stats.billing.pending} invoices`} color="orange"/>
          </div>
        )}

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Monthly Revenue */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h3 className="font-semibold text-gray-900 mb-1">Monthly Revenue</h3>
            <p className="text-xs text-gray-400 mb-5">Last 6 months — paid invoices only</p>
            {monthlyRevenue.length > 0 ? (
              <BarChart data={monthlyRevenue} valueKey="revenue" labelKey="label" color="green" unit="currency"/>
            ) : (
              <div className="h-40 flex items-center justify-center text-sm text-gray-400">No data yet</div>
            )}
          </div>

          {/* Patient Growth */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h3 className="font-semibold text-gray-900 mb-1">Patient Growth</h3>
            <p className="text-xs text-gray-400 mb-5">New patients registered per month</p>
            {patientGrowth.length > 0 ? (
              <BarChart data={patientGrowth} valueKey="count" labelKey="label" color="blue"/>
            ) : (
              <div className="h-40 flex items-center justify-center text-sm text-gray-400">No data yet</div>
            )}
          </div>
        </div>

        {/* Stats breakdown */}
        {stats && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Appointment Breakdown</h3>
              <div className="space-y-3">
                {[
                  { label: 'Scheduled',  value: stats.appointments.upcomingCount,  color: 'bg-blue-500' },
                  { label: 'Completed',  value: stats.appointments.completedCount, color: 'bg-green-500' },
                  { label: 'No Shows',   value: stats.appointments.noShowCount,    color: 'bg-yellow-400' },
                  { label: 'Total',      value: stats.appointments.total,          color: 'bg-gray-300' },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-3">
                    <span className={`w-3 h-3 rounded-full ${item.color} flex-shrink-0`}/>
                    <span className="text-sm text-gray-600 flex-1">{item.label}</span>
                    <span className="text-sm font-semibold text-gray-900">{item.value}</span>
                  </div>
                ))}
                {stats.appointments.total > 0 && (
                  <div className="mt-2">
                    <div className="text-xs text-gray-400 mb-1.5">
                      No-show rate: {((stats.appointments.noShowCount / stats.appointments.total) * 100).toFixed(1)}%
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div className="bg-yellow-400 h-2 rounded-full transition-all"
                        style={{ width: `${(stats.appointments.noShowCount / stats.appointments.total) * 100}%` }}/>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Billing Summary</h3>
              <div className="space-y-3">
                {[
                  { label: 'Paid Invoices',    value: stats.billing.paid,    amount: stats.billing.totalRevenue,  color: 'bg-green-500' },
                  { label: 'Pending Invoices', value: stats.billing.pending, amount: stats.billing.pendingAmount, color: 'bg-blue-500' },
                  { label: 'Overdue',          value: stats.billing.overdue, amount: 0,                           color: 'bg-red-500' },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-3">
                    <span className={`w-3 h-3 rounded-full ${item.color} flex-shrink-0`}/>
                    <span className="text-sm text-gray-600 flex-1">{item.label}</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {item.value} {item.amount > 0 ? `· ${formatCurrency(item.amount)}` : ''}
                    </span>
                  </div>
                ))}
                <div className="mt-3 p-3 bg-gray-50 rounded-xl">
                  <p className="text-xs text-gray-500">Total invoices: <span className="font-semibold text-gray-800">{stats.billing.total}</span></p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
