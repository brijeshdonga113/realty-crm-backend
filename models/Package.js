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

/** Add calendar months to a YYYY-MM-DD date, clamping the day to the target month. */
export function addMonths(dateStr, months) {
  const clean = String(dateStr || '').slice(0, 10)
  const [y, m, d] = clean.split('-').map(Number)
  if (!y || !m) return clean
  const day = d || 1
  const totalMonths = (m - 1) + Number(months || 0)
  const year = y + Math.floor(totalMonths / 12)
  let month = totalMonths % 12
  if (month < 0) month += 12
  const lastDay = new Date(year, month + 1, 0).getDate()
  const dayClamped = Math.min(day, lastDay)
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(dayClamped).padStart(2, '0')}`
}

export function installmentDueDate(startDate, index) {
  const start = String(startDate || '').slice(0, 10)
    || new Date().toISOString().slice(0, 10)
  return addMonths(start, Number(index) || 0)
}

/** Stored dueDate, or monthly from the package start date for older records. */
export function resolveInstallmentDueDate(inst, pkg, index) {
  if (inst?.dueDate) return String(inst.dueDate).slice(0, 10)
  const idx = index != null ? index : Math.max(0, (Number(inst?.number) || 1) - 1)
  return installmentDueDate(pkg?.startDate, idx)
}

export function createInstallments(total, count, startDate) {
  const start = startDate || new Date().toISOString().slice(0, 10)
  return splitInstallmentAmounts(total, count).map((amount, i) => ({
    id:            uid(),
    number:        i + 1,
    amount,
    dueDate:       installmentDueDate(start, i),
    paidAmount:    0,
    paid:          false,
    paidDate:      '',
    paymentMethod: '',
    notes:         '',
  }))
}

/**
 * Outstanding unpaid installments for the Reminders tab.
 * Custom payments cover planned installments in order, so leftover remaining
 * is assigned to the next unpaid slots.
 */
export function buildPackageReminders(packages = [], patientsById = {}) {
  const items = []
  for (const pkg of packages) {
    const summary = summarizePackage(pkg)
    if (pkg.status === 'cancelled' || summary.remaining <= 0) continue
    let paidPool = summary.paidTotal
    let leftover = summary.remaining
    const installments = pkg.installments ?? []
    for (let idx = 0; idx < installments.length; idx++) {
      if (leftover <= 0.009) break
      const inst = installments[idx]
      const planned = Number(inst.amount) || 0
      if (inst.paid) {
        paidPool = Math.max(0, Math.round((paidPool - (Number(inst.paidAmount) || planned)) * 100) / 100)
        continue
      }
      if (paidPool >= planned - 0.009) {
        paidPool = Math.max(0, Math.round((paidPool - planned) * 100) / 100)
        continue
      }
      const uncovered = Math.round((planned - paidPool) * 100) / 100
      paidPool = 0
      const dueAmount = Math.min(uncovered, leftover)
      leftover = Math.round((leftover - dueAmount) * 100) / 100
      if (dueAmount <= 0.009) continue
      items.push({
        id:                 `${pkg.id}:${inst.id}`,
        packageId:          pkg.id,
        installmentId:      inst.id,
        installmentNumber:  inst.number || idx + 1,
        patientId:          pkg.patientId,
        patientName:        pkg.patientName || 'Patient',
        phone:              patientsById[pkg.patientId]?.phone || pkg.patientPhone || '',
        packageName:        pkg.name || 'Package',
        dueDate:            resolveInstallmentDueDate(inst, pkg, idx),
        amount:             planned,
        dueAmount,
        remaining:          summary.remaining,
        totalAmount:        Number(pkg.totalAmount) || 0,
      })
    }
  }
  return items.sort((a, b) => {
    const byDate = (a.dueDate || '').localeCompare(b.dueDate || '')
    if (byDate !== 0) return byDate
    return (a.installmentNumber || 0) - (b.installmentNumber || 0)
  })
}

export function createPayment(data = {}) {
  return {
    id:            data.id ?? uid(),
    amount:        Number(data.amount) || 0,
    date:          data.date || new Date().toISOString().slice(0, 10),
    paymentMethod: data.paymentMethod || 'cash',
    notes:         data.notes ?? '',
    installmentId:  data.installmentId ?? null,
    invoiceId:      data.invoiceId ?? null,
    invoiceNumber:  data.invoiceNumber ?? null,
    createdAt:      data.createdAt ?? new Date().toISOString(),
  }
}

/** Money collected: payments ledger, or paid installments for older records. */
export function paymentsFromPackage(pkg) {
  if (Array.isArray(pkg.payments) && pkg.payments.length > 0) return pkg.payments
  return (pkg.installments ?? []).filter(i => i.paid).map(i => createPayment({
    amount:        i.paidAmount ?? i.amount,
    date:          i.paidDate,
    paymentMethod: i.paymentMethod,
    notes:         i.notes,
    installmentId: i.id,
  }))
}

export function summarizePackage(pkg) {
  const installments = pkg.installments ?? []
  const payments = paymentsFromPackage(pkg)
  const paidTotal = Math.round(payments.reduce((s, p) => s + (Number(p.amount) || 0), 0) * 100) / 100
  const plannedTotal = Number(pkg.totalAmount) || 0
  const remainingRaw = Math.round((plannedTotal - paidTotal) * 100) / 100
  const remaining = Math.max(0, remainingRaw)
  const paidCount = installments.filter(i => i.paid).length
  const derivedStatus = pkg.status === 'cancelled'
    ? 'cancelled'
    : (plannedTotal > 0 && remaining <= 0 ? 'completed' : 'active')
  return {
    paidTotal,
    remaining,
    remainingRaw,
    paymentCount: payments.length,
    paidCount,
    installmentCount: installments.length,
    status: derivedStatus,
    payments,
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
  const startDate = data.startDate ?? now.slice(0, 10)
  const installments = Array.isArray(data.installments) && data.installments.length
    ? data.installments
    : createInstallments(totalAmount, installmentCount, startDate)
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
    startDate,
    notes:            data.notes ?? '',
    status:           data.status ?? summary.status,
    installments,
    payments:         Array.isArray(data.payments) ? data.payments : [],
    paidTotal:        summary.paidTotal,
    remaining:        summary.remaining,
    createdBy:        data.createdBy ?? null,
    createdAt:        data.createdAt ?? now,
    updatedAt:        now,
  }
}
