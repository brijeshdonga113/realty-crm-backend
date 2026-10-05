'use client'
import { useEffect, useMemo, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { createInstallments, installmentDueDate, splitInstallmentAmounts } from '@/models/Package'
import { usePreferences } from '@/hooks/usePreferences'

const today = () => new Date().toISOString().slice(0, 10)

export function AssignPackageModal({
  open,
  onClose,
  patients = [],
  templates = [],
  defaultPatientId = '',
  defaultTemplateId = '',
  onSave,
  viewOnly = false,
}) {
  const { formatCurrency } = usePreferences()
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')
  const [patientQuery, setPatientQuery] = useState('')
  const [form, setForm] = useState({
    patientId:        defaultPatientId,
    templateId:       '',
    name:             '',
    description:      '',
    totalAmount:      '',
    installmentCount: '4',
    sessionCount:     '',
    startDate:        today(),
    notes:            '',
  })
  const [customSplits, setCustomSplits] = useState([])
  const [customDues, setCustomDues]     = useState([])

  useEffect(() => {
    if (!open) return
    setError('')
    setSaving(false)
    setPatientQuery('')
    const tmpl = templates.find(t => t.id === defaultTemplateId)
    setForm({
      patientId:        defaultPatientId,
      templateId:       defaultTemplateId,
      name:             tmpl?.name ?? '',
      description:      tmpl?.description ?? '',
      totalAmount:      tmpl?.totalAmount ? String(tmpl.totalAmount) : '',
      installmentCount: String(tmpl?.installmentCount || 4),
      sessionCount:     tmpl?.sessionCount ? String(tmpl.sessionCount) : '',
      startDate:        today(),
      notes:            tmpl?.notes ?? '',
    })
    setCustomSplits([])
    setCustomDues([])
  }, [open, defaultPatientId, defaultTemplateId, templates])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const applyTemplate = (templateId) => {
    const tmpl = templates.find(t => t.id === templateId)
    set('templateId', templateId)
    if (!tmpl) return
    setForm(f => ({
      ...f,
      templateId,
      name:             tmpl.name ?? '',
      description:      tmpl.description ?? '',
      totalAmount:      tmpl.totalAmount ? String(tmpl.totalAmount) : '',
      installmentCount: String(tmpl.installmentCount || 4),
      sessionCount:     tmpl.sessionCount ? String(tmpl.sessionCount) : '',
      notes:            tmpl.notes ?? f.notes,
    }))
    setCustomSplits([])
    setCustomDues([])
  }

  const count = Math.max(1, Number(form.installmentCount) || 1)
  const total = Number(form.totalAmount) || 0
  const preview = useMemo(() => {
    if (customSplits.length === count) return customSplits
    return splitInstallmentAmounts(total, count)
  }, [customSplits, count, total])

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

  const selectedPatient = patients.find(p => p.id === form.patientId)

  const handleCountChange = (value) => {
    set('installmentCount', value)
    setCustomSplits([])
    setCustomDues([])
  }

  const handleTotalChange = (value) => {
    set('totalAmount', value)
    setCustomSplits([])
  }

  const handleStartDateChange = (value) => {
    set('startDate', value)
    setCustomDues([])
  }

  const handleSplitChange = (idx, value) => {
    const next = [...preview]
    next[idx] = Number(value) || 0
    setCustomSplits(next)
  }

  const duePreview = useMemo(() => {
    if (customDues.length === count) return customDues
    return Array.from({ length: count }, (_, i) => installmentDueDate(form.startDate || today(), i))
  }, [customDues, count, form.startDate])

  const handleDueChange = (idx, value) => {
    const next = [...duePreview]
    next[idx] = value
    setCustomDues(next)
  }

  const splitSum = preview.reduce((s, n) => s + (Number(n) || 0), 0)
  const splitMismatch = total > 0 && Math.abs(splitSum - total) > 0.05

  const handleSave = async (e) => {
    e.preventDefault()
    if (viewOnly) return
    if (!form.patientId) { setError('Select a patient.'); return }
    if (!form.name.trim()) { setError('Enter a package name.'); return }
    if (!total) { setError('Enter the package amount.'); return }
    setSaving(true)
    setError('')
    try {
      const amounts = customSplits.length === count ? customSplits : splitInstallmentAmounts(total, count)
      const dues = customDues.length === count ? customDues : duePreview
      const installments = createInstallments(total, count, form.startDate).map((item, i) => ({
        ...item,
        amount: Number(amounts[i]) || 0,
        dueDate: dues[i] || item.dueDate,
      }))
      await onSave({
        patientId:        form.patientId,
        patientName:      selectedPatient ? `${selectedPatient.firstName} ${selectedPatient.lastName}`.trim() : '',
        patientPhone:     selectedPatient?.phone ?? '',
        templateId:       form.templateId || null,
        name:             form.name.trim(),
        description:      form.description.trim(),
        totalAmount:      total,
        installmentCount: count,
        sessionCount:     form.sessionCount ? Number(form.sessionCount) : null,
        startDate:        form.startDate,
        notes:            form.notes.trim(),
        installments,
      })
      onClose()
    } catch (err) {
      setError(err?.message || 'Could not assign package.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Assign Package" size="lg">
      <form onSubmit={handleSave} className="space-y-4">
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-lg px-3 py-2">{error}</p>
        )}

        <div>
          <label className="form-label">Patient <span className="text-red-500">*</span></label>
          {defaultPatientId && selectedPatient ? (
            <p className="input-field bg-gray-50 dark:bg-gray-700/40">{selectedPatient.firstName} {selectedPatient.lastName} — {selectedPatient.phone}</p>
          ) : (
            <>
              <input
                value={selectedPatient && !patientQuery ? `${selectedPatient.firstName} ${selectedPatient.lastName}` : patientQuery}
                onChange={e => { setPatientQuery(e.target.value); if (form.patientId) set('patientId', '') }}
                placeholder="Search patient by name or phone…"
                className="input-field"
              />
              {!form.patientId && (
                <div className="mt-1 max-h-40 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800">
                  {filteredPatients.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-gray-400">No matching patients</p>
                  ) : filteredPatients.map(p => (
                    <button key={p.id} type="button"
                      onClick={() => { set('patientId', p.id); setPatientQuery('') }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors">
                      <span className="font-medium text-gray-800 dark:text-gray-200">{p.firstName} {p.lastName}</span>
                      <span className="text-xs text-gray-400 ml-2">{p.phone}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {templates.filter(t => t.active !== false).length > 0 && (
          <div>
            <label className="form-label">Bundle deal</label>
            <select value={form.templateId} onChange={e => applyTemplate(e.target.value)} className="input-field">
              <option value="">Custom package…</option>
              {templates.filter(t => t.active !== false).map(t => (
                <option key={t.id} value={t.id}>
                  {t.name} — {formatCurrency(t.totalAmount)} · {t.installmentCount} installments
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="form-label">Package name <span className="text-red-500">*</span></label>
            <input value={form.name} onChange={e => set('name', e.target.value)}
              placeholder="e.g. Hair transplant bundle" className="input-field" required/>
          </div>
          <div>
            <label className="form-label">Total amount <span className="text-red-500">*</span></label>
            <input type="number" min="0" step="0.01" value={form.totalAmount}
              onChange={e => handleTotalChange(e.target.value)} placeholder="0" className="input-field" required/>
          </div>
          <div>
            <label className="form-label">Installments</label>
            <input type="number" min="1" max="24" value={form.installmentCount}
              onChange={e => handleCountChange(e.target.value)} className="input-field"/>
            <p className="text-xs text-gray-400 mt-1">Typical clinic bundles use 4 or 5.</p>
          </div>
          <div>
            <label className="form-label">Sessions (optional)</label>
            <input type="number" min="1" value={form.sessionCount}
              onChange={e => set('sessionCount', e.target.value)} placeholder="e.g. 10" className="input-field"/>
          </div>
          <div>
            <label className="form-label">Start date</label>
            <input type="date" value={form.startDate} onChange={e => handleStartDateChange(e.target.value)} className="input-field"/>
          </div>
        </div>

        <div>
          <label className="form-label">Description</label>
          <textarea value={form.description} onChange={e => set('description', e.target.value)}
            rows={2} placeholder="What’s included in this bundle…" className="input-field resize-none"/>
        </div>

        {total > 0 && (
          <div>
            <label className="form-label">Installment split</label>
            <p className="text-xs text-gray-400 mb-2">Amounts are split evenly. Due dates default to monthly from the start date — adjust either before assigning.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {preview.map((amt, i) => (
                <div key={i} className="rounded-lg border border-gray-100 dark:border-gray-700 p-2">
                  <label className="text-xs text-gray-500 dark:text-gray-400">#{i + 1}</label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <input type="number" min="0" step="0.01" value={amt}
                      onChange={e => handleSplitChange(i, e.target.value)} className="input-field py-1.5 text-sm"
                      aria-label={`Installment ${i + 1} amount`}/>
                    <input type="date" value={duePreview[i] || ''}
                      onChange={e => handleDueChange(i, e.target.value)} className="input-field py-1.5 text-sm"
                      aria-label={`Installment ${i + 1} due date`}/>
                  </div>
                </div>
              ))}
            </div>
            <p className={`text-xs mt-2 ${splitMismatch ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400'}`}>
              Split total {formatCurrency(splitSum)} {splitMismatch ? `· does not match package ${formatCurrency(total)}` : ''}
            </p>
          </div>
        )}

        <div>
          <label className="form-label">Notes</label>
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
            rows={2} placeholder="Optional clinic notes…" className="input-field resize-none"/>
        </div>

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={saving || viewOnly}
            className="flex-1 btn-primary py-2.5 text-sm flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed">
            {saving && (
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            )}
            {saving ? 'Assigning…' : 'Assign Package'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
