import { billingService } from './billingService'
import { patientService } from './patientService'
import { appointmentService } from './appointmentService'
import { visitService } from './visitService'

export const reportService = {
  async getDashboardStats() {
    const [patients, appointments, billing, visits] = await Promise.all([
      patientService.getStats(),
      appointmentService.getStats(),
      billingService.getStats(),
      visitService.getDashboardStats(),
    ])
    return { patients, appointments, billing, visits }
  },

  async getMonthlyRevenue(months = 6) {
    return billingService.getMonthlyRevenue(months)
  },

  async getPatientGrowth(months = 6) {
    const { dataStore } = await import('@/lib/dataStore')
    const all  = await dataStore.getAll('patients')
    const now  = new Date()
    const result = []

    for (let i = months - 1; i >= 0; i--) {
      const d     = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const label  = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
      const prefix = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const count  = all.filter(p => p.createdAt?.startsWith(prefix)).length
      result.push({ label, count })
    }
    return result
  },

  async getAppointmentBreakdown() {
    const { dataStore } = await import('@/lib/dataStore')
    const all = await dataStore.getAll('appointments')
    const breakdown = {}
    all.forEach(a => { breakdown[a.status] = (breakdown[a.status] ?? 0) + 1 })
    return breakdown
  },

  async getTopDiagnoses(limit = 5) {
    const { dataStore } = await import('@/lib/dataStore')
    // visits are stored as a subcollection — use collectionGroup query
    const visits = await dataStore.getAllGroup('visits')
    const counts = {}
    visits.forEach(v => {
      v.diagnosis?.forEach(d => { counts[d] = (counts[d] ?? 0) + 1 })
    })
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([diagnosis, count]) => ({ diagnosis, count }))
  },
}
