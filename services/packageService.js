import { dataStore } from '@/lib/dataStore'
import {
  createPackageTemplate,
  createPatientPackage,
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
    const installments = (current.installments ?? []).map(item => {
      if (item.id !== installmentId) return item
      const paidAmount = payment.paidAmount != null ? Number(payment.paidAmount) : Number(item.amount) || 0
      return {
        ...item,
        paid:          true,
        paidAmount,
        paidDate:      payment.paidDate || new Date().toISOString().slice(0, 10),
        paymentMethod: payment.paymentMethod || item.paymentMethod || 'cash',
        notes:         payment.notes ?? item.notes ?? '',
      }
    })
    return dataStore.update(ENROLLMENTS, id, withSummary(current, { installments }))
  },

  async unmarkInstallment(id, installmentId) {
    const current = await dataStore.getById(ENROLLMENTS, id)
    if (!current) return null
    const installments = (current.installments ?? []).map(item => {
      if (item.id !== installmentId) return item
      return { ...item, paid: false, paidAmount: 0, paidDate: '', paymentMethod: '', notes: item.notes ?? '' }
    })
    const nextStatus = current.status === 'cancelled' ? 'cancelled' : 'active'
    return dataStore.update(ENROLLMENTS, id, withSummary({ ...current, status: nextStatus }, { installments, status: nextStatus }))
  },

  async cancelEnrollment(id) {
    return dataStore.update(ENROLLMENTS, id, { status: 'cancelled' })
  },

  async removeEnrollment(id) {
    return dataStore.remove(ENROLLMENTS, id)
  },
}
