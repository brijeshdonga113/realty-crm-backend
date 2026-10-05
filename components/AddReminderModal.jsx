'use client'
import { useEffect, useMemo, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { localDateStr } from '@/lib/preferences'
import { usePreferences } from '@/hooks/usePreferences'

const PRESETS = [
  { label: 'Today',     days: 0 },
  { label: 'Tomorrow',  days: 1 },
  { label: 'In 3 days', days: 3 },
  { label: 'In 1 week', days: 7 },
]

export function AddReminderModal({
  open,
  onClose,
  patients = [],
  onSave,
  viewOnly = false,
}) {
  const { formatDate } = usePreferences()
  const [patientQuery, setPatientQuery] = useState('')
  const [patientId, setPatientId]       = useState('')
  const [dueDate, setDueDate]           = useState(localDateStr(1))
  const [note, setNote]                 = useState('')
  const [error, setError]               = useState('')
  const [saving, setSaving]             = useState(false)

  useEffect(() => {
    if (!open) return
    setPatientQuery('')
    setPatientId('')
    setDueDate(localDateStr(1))
    setNote('')
    setError('')
    setSaving(false)
  }, [open])

  const filteredPatients = useMemo(() => {
    const q = patientQuery.trim().toLowerCase()
    const digits = q.replace(/\D/g, '')
    if (!q) return patients.slice(0, 40)
    return patients.filter(p => {
      const name = `${p.firstName || ''} ${p.lastName || ''}`.toLowerCase()
      if (name.includes(q)) return true
      if (digits && p.phone && p.phone.replace(/\D/g, '').includes(digits)) return true
      return false
    }).slice(0, 40)
  }, [patients, patientQuery])

  const selected = patients.find(p => p.id === patientId)
  const today = localDateStr()

  const handleSave = async (e) => {
    e?.preventDefault()
    if (viewOnly) return
    if (!patientId) { setError('Select a patient.'); return }
    if (!dueDate) { setError('Pick the day this reminder should appear.'); return }
    setSaving(true)
    setError('')
    try {
      await onSave({
        patientId,
        patientName: selected ? `${selected.firstName} ${selected.lastName}`.trim() : '',
        phone:       selected?.phone ?? '',
        dueDate,
        note:        note.trim(),
      })
      onClose()
    } catch (err) {
      setError(err?.message || 'Could not save reminder.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Reminder" size="sm">
      <form onSubmit={handleSave} className="space-y-4">
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-lg px-3 py-2">{error}</p>
        )}

        <div>
          <label className="form-label">Patient <span className="text-red-500">*</span></label>
          <input
            value={selected && !patientQuery ? `${selected.firstName} ${selected.lastName}` : patientQuery}
            onChange={e => { setPatientQuery(e.target.value); if (patientId) setPatientId('') }}
            placeholder="Search patient by name or phone…"
            className="input-field"
          />
          {!patientId && (
            <div className="mt-1 max-h-40 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800">
              {filteredPatients.length === 0 ? (
                <p className="px-3 py-2 text-sm text-gray-400">No matching patients</p>
              ) : filteredPatients.map(p => (
                <button key={p.id} type="button"
                  onClick={() => { setPatientId(p.id); setPatientQuery('') }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors">
                  <span className="font-medium text-gray-800 dark:text-gray-200">{p.firstName} {p.lastName}</span>
                  <span className="text-xs text-gray-400 ml-2">{p.phone}</span>
                </button>
              ))}
            </div>
          )}
          {selected && (
            <button type="button" onClick={() => { setPatientId(''); setPatientQuery('') }}
              className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 mt-1">
              Change patient
            </button>
          )}
        </div>

        <div>
          <label className="form-label">Show on <span className="text-red-500">*</span></label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {PRESETS.map(p => {
              const value = localDateStr(p.days)
              const active = dueDate === value
              return (
                <button key={p.label} type="button" onClick={() => setDueDate(value)}
                  className={`text-xs font-medium px-2.5 py-1 rounded-lg border transition-colors ${
                    active
                      ? 'bg-orange-500 border-orange-500 text-white'
                      : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}>
                  {p.label}
                </button>
              )
            })}
          </div>
          <input type="date" value={dueDate} min={today}
            onChange={e => setDueDate(e.target.value)} className="input-field"/>
          {dueDate && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">
              {dueDate === today
                ? 'This reminder will appear on the dashboard today.'
                : `This reminder will appear on the dashboard and Follow-ups list on ${formatDate(dueDate)}.`}
            </p>
          )}
        </div>

        <div>
          <label className="form-label">Note <span className="text-gray-400 font-normal">(optional)</span></label>
          <input
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="e.g. Call about installment, review labs…"
            className="input-field"
          />
        </div>

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={saving || viewOnly}
            className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2">
            {saving && (
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            )}
            {saving ? 'Saving…' : 'Set Reminder'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
