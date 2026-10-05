let _counter = 0
function uid() {
  return `${Date.now().toString(36)}-${(++_counter).toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export const PACKAGE_STATUSES = [
  { value: 'active',     label: 'Active',     color: 'blue' },
  { value: 'completed',  label: 'Completed',  color: 'green' },
  { value: 'cancelled',  label: 'Cancelled',  color: 'gray' },
]

export const INSTALLMENT_PAYMENT_METHODS = [
  { value: 'cash',          label: 'Cash' },
  { value: 'upi',           label: 'UPI' },
  { value: 'card',          label: 'Card' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cheque',        label: 'Cheque' },
]

export function getPackageStatusMeta(status) {
  return PACKAGE_STATUSES.find(s => s.value === status) ?? PACKAGE_STATUSES[0]
}

/** Split a total into N installment amounts (last slot absorbs remainder paise). */
export function splitInstallmentAmounts(total, count) {
  const n = Math.max(1, Math.round(Number(count) || 1))
  const cents = Math.round((Number(total) || 0) * 100)
  const base = Math.floor(cents / n)
  const remainder = cents - base * n
  return Array.from({ length: n }, (_, i) => (base + (i === n - 1 ? remainder : 0)) / 100)
}

export function createInstallments(total, count) {
  return splitInstallmentAmounts(total, count).map((amount, i) => ({
    id:            uid(),
    number:        i + 1,
    amount,
    paidAmount:    0,
    paid:          false,
    paidDate:      '',
    paymentMethod: '',
    notes:         '',
  }))
}

export function summarizePackage(pkg) {
  const installments = pkg.installments ?? []
  const paidTotal = Math.round(installments.reduce((s, i) => (
    s + (i.paid ? (Number(i.paidAmount) || 0) : 0)
  ), 0) * 100) / 100
  const plannedTotal = Number(pkg.totalAmount) || 0
  const remaining = Math.round((plannedTotal - paidTotal) * 100) / 100
  const paidCount = installments.filter(i => i.paid).length
  const derivedStatus = pkg.status === 'cancelled'
    ? 'cancelled'
    : (plannedTotal > 0 && remaining <= 0 ? 'completed' : 'active')
  return {
    paidTotal,
    remaining: Math.max(0, remaining),
    paidCount,
    installmentCount: installments.length,
    status: derivedStatus,
  }
}

export function createPackageTemplate(data = {}) {
  const now = new Date().toISOString()
  return {
    id:               data.id ?? uid(),
    doctorId:         data.doctorId ?? '',
    name:             data.name ?? '',
    description:      data.description ?? '',
    totalAmount:      Number(data.totalAmount) || 0,
    installmentCount: Math.max(1, Number(data.installmentCount) || 4),
    sessionCount:     data.sessionCount != null && data.sessionCount !== '' ? Number(data.sessionCount) : null,
    notes:            data.notes ?? '',
    active:           data.active !== false,
    createdAt:        data.createdAt ?? now,
    updatedAt:        now,
  }
}

export function createPatientPackage(data = {}) {
  const now = new Date().toISOString()
  const installmentCount = Math.max(1, Number(data.installmentCount) || 4)
  const totalAmount = Number(data.totalAmount) || 0
  const installments = Array.isArray(data.installments) && data.installments.length
    ? data.installments
    : createInstallments(totalAmount, installmentCount)
  const summary = summarizePackage({ ...data, installments, totalAmount })

  return {
    id:               data.id ?? uid(),
    doctorId:         data.doctorId ?? '',
    patientId:        data.patientId ?? '',
    patientName:      data.patientName ?? '',
    patientPhone:     data.patientPhone ?? '',
    templateId:       data.templateId ?? null,
    name:             data.name ?? '',
    description:      data.description ?? '',
    totalAmount,
    installmentCount: installments.length,
    sessionCount:     data.sessionCount != null && data.sessionCount !== '' ? Number(data.sessionCount) : null,
    startDate:        data.startDate ?? now.slice(0, 10),
    notes:            data.notes ?? '',
    status:           data.status ?? summary.status,
    installments,
    paidTotal:        summary.paidTotal,
    remaining:        summary.remaining,
    createdBy:        data.createdBy ?? null,
    createdAt:        data.createdAt ?? now,
    updatedAt:        now,
  }
}
