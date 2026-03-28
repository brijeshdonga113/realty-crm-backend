import { dataStore } from '@/lib/dataStore'
import { createVisitRecord } from '@/models/VisitRecord'
import { notificationService } from './notificationService'
import { NOTIFICATION_TYPES } from '@/models/Notification'

// Visits are stored as a subcollection: patients/{patientId}/visits
// This matches the Firestore structure: clinics/{doctorId}/patients/{patientId}/visits/{visitId}

function visitPath(patientId) {
  return `patients/${patientId}/visits`
}

export const visitService = {
  async getAll() {
    // collectionGroup query — finds visits across all patients
    const visits = await dataStore.getAllGroup('visits')
    return visits.sort((a, b) => new Date(b.visitDate) - new Date(a.visitDate))
  },

  async getById(id) {
    return dataStore.getByIdGroup('visits', id)
  },

  async getForPatient(patientId) {
    const visits = await dataStore.getAll(visitPath(patientId))
    return visits.sort((a, b) => new Date(b.visitDate) - new Date(a.visitDate))
  },

  async create(data) {
    const visit = createVisitRecord(data)
    const saved = await dataStore.create(visitPath(visit.patientId), visit)

    await notificationService.create({
      type:  NOTIFICATION_TYPES.VISIT_COMPLETED,
      title: 'Visit recorded',
      body:  `Visit for ${saved.patientName} has been saved.`,
      relatedEntity: { type: 'visit', id: saved.id },
    })

    if (saved.followUpDate) {
      await notificationService.create({
        type:  NOTIFICATION_TYPES.FOLLOW_UP_DUE,
        title: 'Follow-up reminder',
        body:  `Follow-up for ${saved.patientName} due on ${saved.followUpDate}.`,
        relatedEntity: { type: 'patient', id: saved.patientId },
      })
    }

    return saved
  },

  async update(id, patch) {
    const existing = await this.getById(id)
    if (!existing) return null
    return dataStore.update(visitPath(existing.patientId), id, patch)
  },

  async remove(id) {
    const existing = await this.getById(id)
    if (!existing) return false
    return dataStore.remove(visitPath(existing.patientId), id)
  },
}
