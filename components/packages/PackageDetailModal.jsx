'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { getPackageStatusMeta, INSTALLMENT_PAYMENT_METHODS, resolveInstallmentDueDate, summarizePackage } from '@/models/Package'
import { usePreferences } from '@/hooks/usePreferences'

const today = () => new Date().toISOString().slice(0, 10)

export function PackageProgress({ paidTotal, totalAmount, compact = false }) {
  const pct = totalAmount > 0 ? Math.min(100, Math.round((paidTotal / totalAmount) * 100)) : 0
  return (
    <div className={compact ? '' : 'space-y-1'}>
      <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className="h-full bg-primary-500 rounded-full transition-all" style={{ width: `${pct}%` }}/>
      </div>
      {!compact && <p className="text-xs text-gray-400">{pct}% collected</p>}
    </div>
  )
}

function AddToBillingCheck({ checked, onChange }) {
  return (
    <label className="flex items-start gap-2.5 cursor-pointer select-none">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
        className="mt-0.5 w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"/>
      <span>
        <span className="text-sm font-medium text-gray-800 dark:text-gray-200">Add to billing</span>
        <span className="block text-xs text-gray-500 dark:text-gray-400">Creates a paid invoice under Billing → Bundles</span>
      </span>
    </label>
  )
}

function PaymentFields({ amount, setAmount, date, setDate, method, setMethod, notes, setNotes }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <div>
        <label className="form-label">Amount</label>
        <input type="number" min="0" step="0.01" value={amount}
          onChange={e => setAmount(e.target.value)} className="input-field py-1.5 text-sm" placeholder="0"/>
      </div>
      <div>
        <label className="form-label">Date</label>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input-field py-1.5 text-sm"/>
      </div>
      <div>
        <label className="form-label">Method</label>
        <select value={method} onChange={e => setMethod(e.target.value)} className="input-field py-1.5 text-sm">
          {INSTALLMENT_PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </div>
      <div>
        <label className="form-label">Note</label>
        <input value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="Optional" className="input-field py-1.5 text-sm"/>
      </div>
    </div>
  )
}

export function PackageDetailModal({
  pkg,
  onClose,
  onMark,
  onUnmark,
  onAddPayment,
  onRemovePayment,
  onCancel,
  onDelete,
  onUpdate,
  viewOnly = false,
}) {
  const { formatCurrency, formatDate } = usePreferences()
  const [payId, setPayId]         = useState(null)
  const [payAmount, setPayAmount] = useState('')
  const [payDate, setPayDate]     = useState(today())
  const [payMethod, setPayMethod] = useState('cash')
  const [payNotes, setPayNotes]   = useState('')
  const [customOpen, setCustomOpen] = useState(false)
  const [customAmount, setCustomAmount] = useState('')
  const [customDate, setCustomDate]     = useState(today())
  const [customMethod, setCustomMethod] = useState('cash')
  const [customNotes, setCustomNotes]   = useState('')
  const [addToBilling, setAddToBilling] = useState(true)
  const [saving, setSaving]       = useState(false)
  const [confirm, setConfirm]     = useState(null)

  useEffect(() => {
    setPayId(null)
    setConfirm(null)
    setCustomOpen(false)
  }, [pkg?.id])

  if (!pkg) return null

  const summary = summarizePackage(pkg)
  const status  = getPackageStatusMeta(pkg.status || summary.status)
  const locked  = viewOnly || pkg.status === 'cancelled'
  const customNum = Number(customAmount) || 0
  const remainingAfter = Math.round((summary.remaining - customNum) * 100) / 100

  const resetCustom = (remaining = summary.remaining) => {
    setCustomAmount(remaining > 0 ? String(remaining) : '')
    setCustomDate(today())
    setCustomMethod('cash')
    setCustomNotes('')
    setAddToBilling(true)
  }

  const openPay = (inst) => {
    setPayId(inst.id)
    setCustomOpen(false)
    setPayAmount(String(inst.amount ?? ''))
    setPayDate(today())
    setPayMethod('cash')
    setPayNotes('')
    setAddToBilling(true)
  }

  const handleMark = async () => {
    if (!payId) return
    setSaving(true)
    try {
      await onMark(pkg.id, payId, {
        paidAmount:    Number(payAmount) || 0,
        paidDate:      payDate,
        paymentMethod: payMethod,
        notes:         payNotes,
        addToBilling,
      })
      setPayId(null)
    } finally {
      setSaving(false)
    }
  }

  const handleCustomPay = async () => {
    if (!onAddPayment || customNum <= 0) return
    setSaving(true)
    try {
      await onAddPayment(pkg.id, {
        amount:        customNum,
        date:          customDate,
        paymentMethod: customMethod,
        notes:         customNotes,
        addToBilling,
      })
      resetCustom(Math.max(0, remainingAfter))
      setCustomOpen(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={!!pkg} onClose={onClose} title={pkg.name || 'Package'} size="lg">
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link href={`/patients/${pkg.patientId}`}
              className="text-sm font-semibold text-primary-600 dark:text-primary-400 hover:underline">
              {pkg.patientName || 'Patient'}
            </Link>
            {pkg.patientPhone && <p className="text-xs text-gray-400 mt-0.5">{pkg.patientPhone}</p>}
            {pkg.description && <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">{pkg.description}</p>}
          </div>
          <Badge label={status.label} color={status.color}/>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gray-50 dark:bg-gray-700/40 rounded-xl p-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">Package total</p>
            <p className="text-sm font-bold text-gray-900 dark:text-white mt-0.5">{formatCurrency(pkg.totalAmount ?? 0)}</p>
          </div>
          <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-3">
            <p className="text-xs text-green-700 dark:text-green-400">Collected</p>
            <p className="text-sm font-bold text-green-700 dark:text-green-400 mt-0.5">{formatCurrency(summary.paidTotal)}</p>
          </div>
          <div className={`rounded-xl p-3 ${summary.remaining > 0 ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-green-50 dark:bg-green-900/20'}`}>
            <p className={`text-xs ${summary.remaining > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-green-700 dark:text-green-400'}`}>Remaining</p>
            <p className={`text-lg font-bold mt-0.5 ${summary.remaining > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-green-700 dark:text-green-400'}`}>
              {formatCurrency(summary.remaining)}
            </p>
          </div>
        </div>

        <PackageProgress paidTotal={summary.paidTotal} totalAmount={pkg.totalAmount ?? 0}/>

        <div className="flex flex-wrap gap-3 text-xs text-gray-500 dark:text-gray-400">
          <span>{summary.paymentCount} payment{summary.paymentCount !== 1 ? 's' : ''}</span>
          <span>· {summary.paidCount}/{summary.installmentCount} planned installments marked</span>
          {pkg.sessionCount ? <span>· {pkg.sessionCount} sessions</span> : null}
          {pkg.startDate ? <span>· started {formatDate(pkg.startDate)}</span> : null}
        </div>

        {!locked && onAddPayment && (
          <div className="rounded-xl border border-primary-200 dark:border-primary-800 bg-primary-50/50 dark:bg-primary-900/10 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Add custom payment</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Record any amount. Remaining now: <span className="font-semibold text-amber-700 dark:text-amber-400">{formatCurrency(summary.remaining)}</span>
                </p>
              </div>
              {!customOpen && (
                <button type="button" onClick={() => { resetCustom(); setPayId(null); setCustomOpen(true) }}
                  className="text-xs font-semibold text-white bg-primary-500 hover:bg-primary-600 px-3 py-1.5 rounded-lg">
                  Add payment
                </button>
              )}
            </div>
            {customOpen && (
              <div className="mt-3 space-y-3">
                <PaymentFields
                  amount={customAmount} setAmount={setCustomAmount}
                  date={customDate} setDate={setCustomDate}
                  method={customMethod} setMethod={setCustomMethod}
                  notes={customNotes} setNotes={setCustomNotes}
                />
                <p className={`text-xs ${remainingAfter > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-green-700 dark:text-green-400'}`}>
                  {customNum > 0
                    ? (remainingAfter > 0
                      ? `Remaining after this payment: ${formatCurrency(remainingAfter)}`
                      : `This clears the package${remainingAfter < 0 ? ` · extra ${formatCurrency(Math.abs(remainingAfter))}` : ''}`)
                    : `Remaining: ${formatCurrency(summary.remaining)}`}
                </p>
                <AddToBillingCheck checked={addToBilling} onChange={setAddToBilling}/>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setCustomOpen(false)}
                    className="flex-1 px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-300">
                    Cancel
                  </button>
                  <button type="button" onClick={handleCustomPay} disabled={saving || customNum <= 0}
                    className="flex-1 btn-primary py-1.5 text-sm disabled:opacity-60">
                    {saving ? 'Saving…' : 'Save payment'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {summary.payments.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Payments</h3>
            <div className="space-y-2">
              {summary.payments.slice().reverse().map(p => (
                <div key={p.id} className="flex items-start justify-between gap-3 rounded-xl border border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10 p-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{formatCurrency(p.amount)}</p>
                    <p className="text-xs text-green-700 dark:text-green-400 mt-0.5">
                      {p.date ? formatDate(p.date) : '—'}
                      {p.paymentMethod ? ` · ${INSTALLMENT_PAYMENT_METHODS.find(m => m.value === p.paymentMethod)?.label ?? p.paymentMethod}` : ''}
                      {p.installmentId ? ' · installment' : ' · custom'}
                    </p>
                    {p.invoiceNumber && (
                      <Link href={`/billing?tab=bundles&invoice=${p.invoiceId}`}
                        className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline mt-0.5 inline-block">
                        Invoice {p.invoiceNumber}
                      </Link>
                    )}
                    {p.notes && <p className="text-xs text-gray-400 mt-0.5">{p.notes}</p>}
                  </div>
                  {!locked && onRemovePayment && (
                    <button onClick={() => onRemovePayment(pkg.id, p.id)}
                      className="text-xs font-medium text-gray-500 hover:text-red-600 dark:hover:text-red-400">
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Installment plan</h3>
          <div className="space-y-2">
            {(pkg.installments ?? []).map(inst => (
              <div key={inst.id}
                className={`rounded-xl border p-3 ${inst.paid
                  ? 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10'
                  : 'border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      Installment {inst.number}
                      <span className="ml-2 font-normal text-gray-500">{formatCurrency(inst.amount ?? 0)}</span>
                    </p>
                    {inst.paid ? (
                      <p className="text-xs text-green-700 dark:text-green-400 mt-1">
                        Marked {formatCurrency(inst.paidAmount ?? 0)}
                        {inst.paidDate ? ` on ${formatDate(inst.paidDate)}` : ''}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-400 mt-1">
                        Due {formatDate(resolveInstallmentDueDate(inst, pkg))}
                      </p>
                    )}
                    {!locked && !inst.paid && onUpdate && (
                      <input type="date" value={resolveInstallmentDueDate(inst, pkg)}
                        onChange={e => {
                          const dueDate = e.target.value
                          const installments = (pkg.installments ?? []).map(item =>
                            item.id === inst.id ? { ...item, dueDate } : item
                          )
                          onUpdate(pkg.id, { installments })
                        }}
                        className="input-field py-1 mt-2 text-xs w-40"/>
                    )}
                  </div>
                  {!locked && (
                    inst.paid ? (
                      <button onClick={() => onUnmark(pkg.id, inst.id)}
                        className="text-xs font-medium text-gray-500 hover:text-amber-600 dark:hover:text-amber-400">
                        Undo
                      </button>
                    ) : (
                      <button onClick={() => openPay(inst)}
                        className="text-xs font-medium text-green-600 dark:text-green-400 hover:underline">
                        Mark paid
                      </button>
                    )
                  )}
                </div>

                {payId === inst.id && (
                  <div className="mt-3 space-y-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                    <PaymentFields
                      amount={payAmount} setAmount={setPayAmount}
                      date={payDate} setDate={setPayDate}
                      method={payMethod} setMethod={setPayMethod}
                      notes={payNotes} setNotes={setPayNotes}
                    />
                    <AddToBillingCheck checked={addToBilling} onChange={setAddToBilling}/>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setPayId(null)}
                        className="flex-1 px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-300">
                        Cancel
                      </button>
                      <button type="button" onClick={handleMark} disabled={saving}
                        className="flex-1 btn-primary py-1.5 text-sm disabled:opacity-60">
                        {saving ? 'Saving…' : 'Save payment'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {pkg.notes && (
          <p className="text-xs text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-700 pt-3">{pkg.notes}</p>
        )}

        {!viewOnly && (
          <div className="flex flex-wrap gap-2 pt-1 border-t border-gray-100 dark:border-gray-700">
            {pkg.status !== 'cancelled' && pkg.status !== 'completed' && (
              <button onClick={() => setConfirm('cancel')}
                className="text-xs font-medium text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 px-2 py-1">
                Cancel package
              </button>
            )}
            <button onClick={() => setConfirm('delete')}
              className="text-xs font-medium text-red-500 hover:text-red-700 px-2 py-1 ml-auto">
              Delete
            </button>
          </div>
        )}

        {confirm && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3">
            <p className="text-sm text-red-700 dark:text-red-300 mb-3">
              {confirm === 'delete' ? 'Delete this package and its installment history?' : 'Cancel this package? Remaining installments will stay unpaid.'}
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirm(null)}
                className="flex-1 px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg">
                Keep
              </button>
              <button
                onClick={async () => {
                  if (confirm === 'delete') await onDelete(pkg.id)
                  else await onCancel(pkg.id)
                  setConfirm(null)
                  onClose()
                }}
                className="flex-1 px-3 py-1.5 text-sm bg-red-500 hover:bg-red-600 text-white rounded-lg">
                {confirm === 'delete' ? 'Delete' : 'Cancel package'}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
