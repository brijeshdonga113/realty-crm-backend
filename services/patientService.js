import { dataStore } from '@/lib/dataStore'
import { createPatient, getPatientFullName } from '@/models/Patient'
import { notificationService } from './notificationService'
import { NOTIFICATION_TYPES } from '@/models/Notification'

const COLLECTION   = 'patients'
const COUNTER_KEY  = 'patientCounter'
const COUNTER_START = 2001

async function nextPatientNumber() {
  const current = (await dataStore.getMeta(COUNTER_KEY)) ?? (COUNTER_START - 1)
  const next    = current + 1
  await dataStore.setMeta(COUNTER_KEY, next)
  return next
}

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
    let patientNumber = data.patientNumber ? Number(data.patientNumber) : null
    try {
      if (patientNumber) {
        // Keep the counter in sync: if the assigned number is >= current counter, advance it
        const current = (await dataStore.getMeta(COUNTER_KEY)) ?? (COUNTER_START - 1)
        if (patientNumber >= current + 1) {
          await dataStore.setMeta(COUNTER_KEY, patientNumber)
        }
      } else {
        patientNumber = await nextPatientNumber()
      }
    } catch {
      // Counter update failed (e.g. Firestore rules) — use provided number or a timestamp fallback
      patientNumber = patientNumber ?? (COUNTER_START + (Date.now() % 100000))
    }
    const patient = createPatient({ ...data, patientNumber })
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

  async peekNextPatientNumber() {
    const current = (await dataStore.getMeta(COUNTER_KEY)) ?? (COUNTER_START - 1)
    return current + 1
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
