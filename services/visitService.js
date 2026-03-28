import { dataStore } from '@/lib/dataStore'
import { createVisitRecord } from '@/models/VisitRecord'
import { notificationService } from './notificationService'
import { NOTIFICATION_TYPES } from '@/models/Notification'

const COLLECTION = 'visits'

export const visitService = {
  async getAll() {
    const visits = await dataStore.getAll(COLLECTION)
    return visits.sort((a, b) => new Date(b.visitDate) - new Date(a.visitDate))
  },

  async getById(id) {
    return dataStore.getById(COLLECTION, id)
  },

  async getForPatient(patientId) {
    const visits = await dataStore.query(COLLECTION, v => v.patientId === patientId)
    return visits.sort((a, b) => new Date(b.visitDate) - new Date(a.visitDate))
  },

  async create(data) {
    const visit = createVisitRecord(data)
    const saved = await dataStore.create(COLLECTION, visit)

    await notificationService.create({
      type:  NOTIFICATION_TYPES.VISIT_COMPLETED,
      title: 'Visit recorded',
      body:  `Visit for ${saved.patientName} has been saved.`,
      relatedEntity: { type: 'visit', id: saved.id },
    })

    // Schedule follow-up notification if followUpDate set
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
    return dataStore.update(COLLECTION, id, patch)
  },

  async remove(id) {
    return dataStore.remove(COLLECTION, id)
  },
}
