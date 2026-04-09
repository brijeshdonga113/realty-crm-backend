'use client'
import { useState } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { useStaff } from '@/hooks/useStaff'
import { STAFF_ROLES, STAFF_STATUSES, getStaffFullName, getStaffRoleLabel } from '@/models/Staff'

const STATUS_COLOR = { active: 'green', on_leave: 'yellow', terminated: 'red' }

const WORK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const emptyForm = {
  firstName: '', lastName: '', role: 'receptionist', email: '', phone: '',
  status: 'active', joinDate: new Date().toISOString().slice(0, 10), notes: '',
  schedule: { workDays: ['Monday','Tuesday','Wednesday','Thursday','Friday'], startTime: '09:00', endTime: '17:00' },
}

function StaffForm({ initial, onSave, onCancel }) {
  const [form, setForm]   = useState(initial ?? emptyForm)
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

      {/* Schedule */}
      <div>
        <label className="form-label">Work Days</label>
        <div className="flex flex-wrap gap-2">
          {WORK_DAYS.map(day => (
            <button key={day} type="button" onClick={() => toggleDay(day)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                ${form.schedule.workDays.includes(day)
                  ? 'bg-primary-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
              {day.slice(0,3)}
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
        <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} className="input-field resize-none"/>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel}
          className="px-4 py-2 border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
          Cancel
        </button>
        <button type="submit" disabled={loading}
          className="px-6 py-2 bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60">
          {loading ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  )
}

export default function StaffPage() {
  const { staff, loading, add, update, remove } = useStaff()
  const [showAdd, setShowAdd]   = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [deleteId, setDeleteId] = useState(null)

  return (
    <AppLayout
      title="Staff"
      action={
        <button onClick={() => setShowAdd(true)}
          className="bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-2">
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
          Loading staff…
        </div>
      ) : staff.length === 0 ? (
        <EmptyState
          title="No staff members"
          description="Add your clinic staff to manage their schedules and roles."
          action={() => setShowAdd(true)}
          actionLabel="Add Staff Member"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {staff.map(member => (
            <div key={member.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/40 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-primary-700 dark:text-primary-300 font-bold text-sm">
                      {member.firstName?.[0]}{member.lastName?.[0]}
                    </span>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white text-sm">{getStaffFullName(member)}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{getStaffRoleLabel(member.role)}</p>
                  </div>
                </div>
                <Badge label={member.status} color={STATUS_COLOR[member.status] ?? 'gray'}/>
              </div>

              <div className="space-y-1.5 text-xs text-gray-500 dark:text-gray-400">
                {member.phone && <p>📞 {member.phone}</p>}
                {member.email && <p>✉️ {member.email}</p>}
                <p>🗓️ {member.schedule.workDays.map(d => d.slice(0,3)).join(', ')} · {member.schedule.startTime} – {member.schedule.endTime}</p>
              </div>

              <div className="flex gap-2 mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
                <button onClick={() => setEditItem(member)}
                  className="flex-1 text-xs font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 py-1.5 rounded-lg transition-colors">
                  Edit
                </button>
                <button onClick={() => setDeleteId(member.id)}
                  className="flex-1 text-xs font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 py-1.5 rounded-lg transition-colors">
                  Remove
                </button>
              </div>
            </div>
          ))}
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
        <p className="text-gray-600 dark:text-gray-300 text-sm mb-6">Are you sure you want to remove this staff member?</p>
        <div className="flex gap-3 justify-end">
          <button onClick={() => setDeleteId(null)}
            className="px-4 py-2 border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            Cancel
          </button>
          <button onClick={async () => { await remove(deleteId); setDeleteId(null) }}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors">
            Remove
          </button>
        </div>
      </Modal>
    </AppLayout>
  )
}
