import { dataStore } from '@/lib/dataStore'
import {
  createPackageTemplate,
  createPatientPackage,
  createPayment,
  paymentsFromPackage,
  summarizePackage,
} from '@/models/Package'

const TEMPLATES = 'packageTemplates'
const ENROLLMENTS = 'patientPackages'

function createdByFromSession() {
  try {
    const session = JSON.parse(localStorage.getItem('clinic_crm_doctor') ?? 'null')
    if (session?._role === 'receptionist') {
      return { role: 'receptionist', name: session._receptionistName ?? '', uid: session._receptionistUid ?? '' }
    }
    if (session?.id) {
      return { role: 'doctor', name: `Dr. ${session.firstName ?? ''} ${session.lastName ?? ''}`.trim(), uid: session.id }
    }
  } catch {}
  return null
}

function withSummary(pkg, extra = {}) {
  const next = { ...pkg, ...extra }
  const summary = summarizePackage(next)
  return {
    ...next,
    paidTotal:        summary.paidTotal,
    remaining:        summary.remaining,
    installmentCount: summary.installmentCount,
    status:           extra.status === 'cancelled' ? 'cancelled' : summary.status,
  }
}

export const packageService = {
  async getTemplates() {
    const rows = await dataStore.getAll(TEMPLATES)
    return rows.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
  },

  async createTemplate(data) {
    return dataStore.create(TEMPLATES, createPackageTemplate(data))
  },

  async updateTemplate(id, patch) {
    return dataStore.update(TEMPLATES, id, patch)
  },

  async removeTemplate(id) {
    return dataStore.remove(TEMPLATES, id)
  },

  async getEnrollments() {
    const rows = await dataStore.getAll(ENROLLMENTS)
    return rows.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
  },

  async getForPatient(patientId) {
    return dataStore.getWhere(ENROLLMENTS, 'patientId', '==', patientId)
  },

  async createEnrollment(data) {
    const createdBy = data.createdBy ?? createdByFromSession()
    return dataStore.create(ENROLLMENTS, createPatientPackage({ ...data, createdBy }))
  },

  async updateEnrollment(id, patch) {
    const current = await dataStore.getById(ENROLLMENTS, id)
    if (!current) return null
    return dataStore.update(ENROLLMENTS, id, withSummary(current, patch))
  },

  async markInstallment(id, installmentId, payment) {
    const current = await dataStore.getById(ENROLLMENTS, id)
    if (!current) return null
    const paidAmount = payment.paidAmount != null ? Number(payment.paidAmount) : 0
    const paidDate = payment.paidDate || new Date().toISOString().slice(0, 10)
    const paymentMethod = payment.paymentMethod || 'cash'
    const notes = payment.notes ?? ''
    const installments = (current.installments ?? []).map(item => {
      if (item.id !== installmentId) return item
      return { ...item, paid: true, paidAmount, paidDate, paymentMethod, notes }
    })
    const payments = paymentsFromPackage(current)
      .filter(p => p.installmentId !== installmentId)
      .concat(createPayment({ amount: paidAmount, date: paidDate, paymentMethod, notes, installmentId }))
    return dataStore.update(ENROLLMENTS, id, withSummary(current, { installments, payments }))
  },

  async unmarkInstallment(id, installmentId) {
    const current = await dataStore.getById(ENROLLMENTS, id)
    if (!current) return null
    const installments = (current.installments ?? []).map(item => {
      if (item.id !== installmentId) return item
      return { ...item, paid: false, paidAmount: 0, paidDate: '', paymentMethod: '', notes: item.notes ?? '' }
    })
    const payments = paymentsFromPackage(current).filter(p => p.installmentId !== installmentId)
    const nextStatus = current.status === 'cancelled' ? 'cancelled' : 'active'
    return dataStore.update(ENROLLMENTS, id, withSummary({ ...current, status: nextStatus }, { installments, payments, status: nextStatus }))
  },

  async addPayment(id, payment) {
    const current = await dataStore.getById(ENROLLMENTS, id)
    if (!current) return null
    const amount = Number(payment.amount) || 0
    if (amount <= 0) return current
    const nextPayment = createPayment({
      amount,
      date:          payment.date || new Date().toISOString().slice(0, 10),
      paymentMethod: payment.paymentMethod || 'cash',
      notes:         payment.notes ?? '',
      installmentId: payment.installmentId ?? null,
    })
    const payments = [...paymentsFromPackage(current), nextPayment]
    return dataStore.update(ENROLLMENTS, id, withSummary(current, { payments }))
  },

  async removePayment(id, paymentId) {
    const current = await dataStore.getById(ENROLLMENTS, id)
    if (!current) return null
    const existing = paymentsFromPackage(current)
    const removed = existing.find(p => p.id === paymentId)
    const payments = existing.filter(p => p.id !== paymentId)
    let installments = current.installments ?? []
    if (removed?.installmentId) {
      installments = installments.map(item => {
        if (item.id !== removed.installmentId) return item
        return { ...item, paid: false, paidAmount: 0, paidDate: '', paymentMethod: '', notes: item.notes ?? '' }
      })
    }
    const nextStatus = current.status === 'cancelled' ? 'cancelled' : 'active'
    return dataStore.update(ENROLLMENTS, id, withSummary({ ...current, status: nextStatus }, { payments, installments, status: nextStatus }))
  },

  async cancelEnrollment(id) {
    return dataStore.update(ENROLLMENTS, id, { status: 'cancelled' })
  },

  async removeEnrollment(id) {
    return dataStore.remove(ENROLLMENTS, id)
  },
}
