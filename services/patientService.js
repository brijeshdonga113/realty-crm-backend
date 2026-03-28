import { dataStore } from '@/lib/dataStore'
import { createPatient, getPatientFullName } from '@/models/Patient'
import { notificationService } from './notificationService'
import { NOTIFICATION_TYPES } from '@/models/Notification'

const COLLECTION = 'patients'

export const patientService = {
  async getAll() {
    const patients = await dataStore.getAll(COLLECTION)
    return patients.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  },

  async getById(id) {
    return dataStore.getById(COLLECTION, id)
  },

  async search(query) {
    const q = query.toLowerCase()
    return dataStore.query(COLLECTION, p =>
      p.firstName.toLowerCase().includes(q) ||
      p.lastName.toLowerCase().includes(q) ||
      p.phone.includes(q) ||
      p.email.toLowerCase().includes(q) ||
      p.nationalId?.toLowerCase().includes(q)
    )
  },

  async create(data) {
    const patient = createPatient(data)
    const saved = await dataStore.create(COLLECTION, patient)

    await notificationService.create({
      type:  NOTIFICATION_TYPES.PATIENT_NEW,
      title: 'New patient registered',
      body:  `${getPatientFullName(saved)} has been added to your patient list.`,
      relatedEntity: { type: 'patient', id: saved.id },
    })

    return saved
  },

  async update(id, patch) {
    return dataStore.update(COLLECTION, id, patch)
  },

  async remove(id) {
    return dataStore.remove(COLLECTION, id)
  },

  async getStats() {
    const all = await dataStore.getAll(COLLECTION)
    const active = all.filter(p => p.status === 'active').length
    const thisMonth = all.filter(p => {
      const d = new Date(p.createdAt)
      const now = new Date()
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    }).length
    return { total: all.length, active, thisMonth }
  },
}
