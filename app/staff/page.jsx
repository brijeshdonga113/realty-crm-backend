'use client'
import { useState, useMemo } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { useStaff } from '@/hooks/useStaff'
import { STAFF_ROLES, STAFF_STATUSES, getStaffFullName, getStaffRoleLabel } from '@/models/Staff'
import AutoTextarea from '@/components/ui/AutoTextarea'

const STATUS_CONFIG = {
  active:     { label: 'Active',     dot: 'bg-green-400',  text: 'text-green-700 dark:text-green-400',  bg: 'bg-green-50 dark:bg-green-900/20' },
  on_leave:   { label: 'On Leave',   dot: 'bg-amber-400',  text: 'text-amber-700 dark:text-amber-400',  bg: 'bg-amber-50 dark:bg-amber-900/20' },
  terminated: { label: 'Terminated', dot: 'bg-red-400',    text: 'text-red-700 dark:text-red-400',      bg: 'bg-red-50 dark:bg-red-900/20' },
}

const ROLE_COLORS = [
  'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300',
  'bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300',
  'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
  'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300',
  'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
  'bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300',
]

const WORK_DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']

const emptyForm = {
  firstName: '', lastName: '', role: 'receptionist', email: '', phone: '',
  status: 'active', joinDate: new Date().toISOString().slice(0, 10), notes: '',
  schedule: { workDays: ['Monday','Tuesday','Wednesday','Thursday','Friday'], startTime: '09:00', endTime: '17:00' },
}

function getRoleColor(role) {
  const idx = STAFF_ROLES.findIndex(r => r.value === role)
  return ROLE_COLORS[idx % ROLE_COLORS.length] ?? ROLE_COLORS[0]
}

function Avatar({ member, size = 'md' }) {
  const sizeClass = size === 'lg' ? 'w-14 h-14 text-base' : 'w-11 h-11 text-sm'
  return (
    <div className={`${sizeClass} rounded-2xl flex items-center justify-center font-bold flex-shrink-0 ${getRoleColor(member.role)}`}>
      {member.firstName?.[0]?.toUpperCase()}{member.lastName?.[0]?.toUpperCase()}
    </div>
  )
}

function StatusPill({ status }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.active
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.text} ${cfg.bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`}/>
      {cfg.label}
    </span>
  )
}

function StaffForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial ?? emptyForm)
  const [loading, setLoading] = useState(false)

  const set = (k, v) => setForm(p => ({...p, [k]: v}))
  const setSched = (k, v) => setForm(p => ({...p, schedule: {...p.schedule, [k]: v}}))
  const toggleDay = (day) => {
    const days = form.schedule.workDays.includes(day)
      ? form.schedule.workDays.filter(d => d !== day)
      : [...form.schedule.workDays, day]
    setSched('workDays', days)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try { await onSave(form) } finally { setLoading(false) }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="form-label">First Name *</label>
          <input value={form.firstName} onChange={e => set('firstName', e.target.value)} className="input-field" required/>
        </div>
        <div>
          <label className="form-label">Last Name *</label>
          <input value={form.lastName} onChange={e => set('lastName', e.target.value)} className="input-field" required/>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="form-label">Role</label>
          <select value={form.role} onChange={e => set('role', e.target.value)} className="input-field">
            {STAFF_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
        <div>
          <label className="form-label">Status</label>
          <select value={form.status} onChange={e => set('status', e.target.value)} className="input-field">
            {STAFF_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="form-label">Email</label>
          <input type="email" value={form.email} onChange={e => set('email', e.target.value)} className="input-field"/>
        </div>
        <div>
          <label className="form-label">Phone *</label>
          <input value={form.phone} onChange={e => set('phone', e.target.value)} className="input-field" required/>
        </div>
      </div>
      <div>
        <label className="form-label">Join Date</label>
        <input type="date" value={form.joinDate} onChange={e => set('joinDate', e.target.value)} className="input-field"/>
      </div>

      <div>
        <label className="form-label">Work Days</label>
        <div className="flex flex-wrap gap-2 mt-1">
          {WORK_DAYS.map(day => (
            <button key={day} type="button" onClick={() => toggleDay(day)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                form.schedule.workDays.includes(day)
                  ? 'bg-primary-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
              {day.slice(0, 3)}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="form-label">Start Time</label>
          <input type="time" value={form.schedule.startTime} onChange={e => setSched('startTime', e.target.value)} className="input-field"/>
        </div>
        <div>
          <label className="form-label">End Time</label>
          <input type="time" value={form.schedule.endTime} onChange={e => setSched('endTime', e.target.value)} className="input-field"/>
        </div>
      </div>
      <div>
        <label className="form-label">Notes</label>
        <AutoTextarea value={form.notes} onChange={e => set('notes', e.target.value)} className="input-field resize-y"/>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel}
          className="px-4 py-2 border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
          Cancel
        </button>
        <button type="submit" disabled={loading}
          className="px-6 py-2 bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60">
          {loading ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  )
}

export default function StaffPage() {
  const { staff, loading, add, update, remove } = useStaff()
  const [showAdd,  setShowAdd]  = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const [search,   setSearch]   = useState('')
  const [roleFilter, setRoleFilter] = useState('all')

  const stats = useMemo(() => ({
    total:      staff.length,
    active:     staff.filter(s => s.status === 'active').length,
    onLeave:    staff.filter(s => s.status === 'on_leave').length,
    terminated: staff.filter(s => s.status === 'terminated').length,
  }), [staff])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return staff.filter(m => {
      const nameMatch = getStaffFullName(m).toLowerCase().includes(q) ||
        m.email?.toLowerCase().includes(q) || m.phone?.includes(q)
      const roleMatch = roleFilter === 'all' || m.role === roleFilter
      return nameMatch && roleMatch
    })
  }, [staff, search, roleFilter])

  return (
    <AppLayout
      title="Staff"
      action={
        <button onClick={() => setShowAdd(true)}
          className="bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
          </svg>
          Add Staff
        </button>
      }
    >
      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400 text-sm gap-3">
          <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          Loading…
        </div>
      ) : staff.length === 0 ? (
        <EmptyState
          title="No staff members yet"
          description="Add your clinic staff to manage their roles and schedules."
          action={() => setShowAdd(true)}
          actionLabel="Add Staff Member"
        />
      ) : (
        <div className="space-y-5">

          {/* ── Stats ─────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Staff', value: stats.total,      color: 'text-gray-700 dark:text-gray-200',  bg: 'bg-white dark:bg-gray-800' },
              { label: 'Active',      value: stats.active,     color: 'text-green-600 dark:text-green-400', bg: 'bg-white dark:bg-gray-800' },
              { label: 'On Leave',    value: stats.onLeave,    color: 'text-amber-600 dark:text-amber-400', bg: 'bg-white dark:bg-gray-800' },
              { label: 'Terminated',  value: stats.terminated, color: 'text-red-500 dark:text-red-400',     bg: 'bg-white dark:bg-gray-800' },
            ].map(s => (
              <div key={s.label} className={`${s.bg} rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm px-5 py-4`}>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{s.label}</p>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* ── Search + Filter ───────────────────────────────────────── */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search by name, email or phone…"
                className="input-field pl-9 w-full"/>
            </div>
            <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
              className="input-field sm:w-52">
              <option value="all">All Roles</option>
              {STAFF_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>

          {/* ── Cards ─────────────────────────────────────────────────── */}
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-sm text-gray-400">No staff match your search.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map(member => (
                <div key={member.id}
                  className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow">

                  {/* Card header */}
                  <div className="flex items-start gap-3 p-5 pb-4">
                    <Avatar member={member}/>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-white text-sm leading-tight truncate">
                        {getStaffFullName(member)}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {getStaffRoleLabel(member.role)}
                      </p>
                      <div className="mt-2">
                        <StatusPill status={member.status}/>
                      </div>
                    </div>
                  </div>

                  {/* Info rows */}
                  <div className="px-5 pb-4 space-y-2 border-t border-gray-50 dark:border-gray-700/50 pt-3">
                    {member.phone && (
                      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
                        </svg>
                        {member.phone}
                      </div>
                    )}
                    {member.email && (
                      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                        </svg>
                        <span className="truncate">{member.email}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                      </svg>
                      <span>{member.schedule?.workDays?.map(d => d.slice(0,3)).join(', ')}</span>
                      <span className="text-gray-300 dark:text-gray-600">·</span>
                      <span>{member.schedule?.startTime} – {member.schedule?.endTime}</span>
                    </div>
                    {member.joinDate && (
                      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                        </svg>
                        Joined {new Date(member.joinDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex border-t border-gray-100 dark:border-gray-700">
                    <button onClick={() => setEditItem(member)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors rounded-bl-xl">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                      </svg>
                      Edit
                    </button>
                    <div className="w-px bg-gray-100 dark:bg-gray-700"/>
                    <button onClick={() => setDeleteId(member.id)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors rounded-br-xl">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                      </svg>
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Staff Member" size="md">
        <StaffForm
          onSave={async (data) => { await add(data); setShowAdd(false) }}
          onCancel={() => setShowAdd(false)}
        />
      </Modal>

      {/* Edit modal */}
      <Modal open={!!editItem} onClose={() => setEditItem(null)} title="Edit Staff Member" size="md">
        {editItem && (
          <StaffForm
            initial={editItem}
            onSave={async (data) => { await update(editItem.id, data); setEditItem(null) }}
            onCancel={() => setEditItem(null)}
          />
        )}
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Remove Staff Member" size="sm">
        <p className="text-gray-600 dark:text-gray-300 text-sm mb-6">Are you sure you want to remove this staff member? This action cannot be undone.</p>
        <div className="flex gap-3 justify-end">
          <button onClick={() => setDeleteId(null)}
            className="px-4 py-2 border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            Cancel
          </button>
          <button onClick={async () => { await remove(deleteId); setDeleteId(null) }}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-colors">
            Remove
          </button>
        </div>
      </Modal>
    </AppLayout>
  )
}
