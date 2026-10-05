'use client'
import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/Modal'

const EMPTY = { name: '', description: '', totalAmount: '', installmentCount: '4', sessionCount: '', notes: '' }

export function TemplateFormModal({ open, onClose, initial, onSave, viewOnly = false }) {
  const [form, setForm]     = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  useEffect(() => {
    if (!open) return
    setError('')
    setSaving(false)
    if (initial) {
      setForm({
        name:             initial.name ?? '',
        description:      initial.description ?? '',
        totalAmount:      initial.totalAmount != null ? String(initial.totalAmount) : '',
        installmentCount: String(initial.installmentCount || 4),
        sessionCount:     initial.sessionCount != null ? String(initial.sessionCount) : '',
        notes:            initial.notes ?? '',
      })
    } else {
      setForm(EMPTY)
    }
  }, [open, initial])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async (e) => {
    e.preventDefault()
    if (viewOnly) return
    if (!form.name.trim() || !form.totalAmount) {
      setError('Name and amount are required.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await onSave({
        name:             form.name.trim(),
        description:      form.description.trim(),
        totalAmount:      Number(form.totalAmount) || 0,
        installmentCount: Math.max(1, Number(form.installmentCount) || 4),
        sessionCount:     form.sessionCount ? Number(form.sessionCount) : null,
        notes:            form.notes.trim(),
        active:           true,
      })
      onClose()
    } catch (err) {
      setError(err?.message || 'Could not save bundle.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Edit Bundle Deal' : 'New Bundle Deal'} size="md">
      <form onSubmit={handleSave} className="space-y-4">
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-lg px-3 py-2">{error}</p>
        )}
        <div>
          <label className="form-label">Name <span className="text-red-500">*</span></label>
          <input value={form.name} onChange={e => set('name', e.target.value)}
            placeholder="e.g. Physio 10-session pack" className="input-field" required autoFocus/>
        </div>
        <div>
          <label className="form-label">Description</label>
          <textarea value={form.description} onChange={e => set('description', e.target.value)}
            rows={2} placeholder="What’s included…" className="input-field resize-none"/>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="form-label">Total amount <span className="text-red-500">*</span></label>
            <input type="number" min="0" step="0.01" value={form.totalAmount}
              onChange={e => set('totalAmount', e.target.value)} placeholder="0" className="input-field" required/>
          </div>
          <div>
            <label className="form-label">Installments</label>
            <input type="number" min="1" max="24" value={form.installmentCount}
              onChange={e => set('installmentCount', e.target.value)} className="input-field"/>
          </div>
          <div>
            <label className="form-label">Sessions (optional)</label>
            <input type="number" min="1" value={form.sessionCount}
              onChange={e => set('sessionCount', e.target.value)} placeholder="e.g. 10" className="input-field"/>
          </div>
        </div>
        <div>
          <label className="form-label">Notes</label>
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
            rows={2} placeholder="Optional" className="input-field resize-none"/>
        </div>
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={saving || viewOnly}
            className="flex-1 btn-primary py-2.5 text-sm disabled:opacity-60">
            {saving ? 'Saving…' : initial ? 'Save Changes' : 'Create Bundle'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
