import { dataStore } from '@/lib/dataStore'
import { createVisitRecord } from '@/models/VisitRecord'
import { notificationService } from './notificationService'
import { NOTIFICATION_TYPES } from '@/models/Notification'
import { followupService } from './followupService'

// Visits are stored as a subcollection: patients/{patientId}/visits
// This matches the Firestore structure: users/{doctorId}/patients/{patientId}/visits/{visitId}

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

    // Fire-and-forget — never let notification failures block visit creation
    notificationService.create({
      type:  NOTIFICATION_TYPES.VISIT_COMPLETED,
      title: 'Visit recorded',
      body:  `Visit for ${saved.patientName} has been saved.`,
      relatedEntity: { type: 'visit', id: saved.id },
    }).catch(() => {})

    if (saved.followUpDate) {
      followupService.create({
        patientId:   saved.patientId,
        patientName: saved.patientName,
        dueDate:     saved.followUpDate,
        note:        saved.chiefComplaint || '',
        doctorId:    saved.doctorId,
        visitId:     saved.id,
      }).catch(() => {})
    }

    return saved
  },

  async update(id, patch) {
    const existing = await this.getById(id)
    if (!existing) return null
    const updated = await dataStore.update(visitPath(existing.patientId), id, patch)

    // Sync linked follow-up record if followUpDate was touched
    if ('followUpDate' in patch) {
      const linked = await followupService.getByVisitId(id).catch(() => null)
      const newDate = patch.followUpDate

      if (newDate && linked) {
        // Date changed — update the existing record
        if (linked.dueDate !== newDate) {
          followupService.update(linked.id, { dueDate: newDate }).catch(() => {})
        }
      } else if (newDate && !linked) {
        // Follow-up newly added — create a record
        followupService.create({
          patientId:   existing.patientId,
          patientName: existing.patientName,
          dueDate:     newDate,
          note:        patch.chiefComplaint ?? existing.chiefComplaint ?? '',
          doctorId:    existing.doctorId,
          visitId:     id,
        }).catch(() => {})
      } else if (!newDate && linked) {
        // Follow-up removed — delete the record
        followupService.remove(linked.id).catch(() => {})
      }
    }

    return updated
  },

  async remove(id) {
    const existing = await this.getById(id)
    if (!existing) return false

    // Remove linked follow-up record if present
    followupService.getByVisitId(id)
      .then(linked => { if (linked) followupService.remove(linked.id) })
      .catch(() => {})

    return dataStore.remove(visitPath(existing.patientId), id)
  },

  async getDashboardStats() {
    const today    = new Date().toISOString().slice(0, 10)
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
    const all = await dataStore.getAllGroup('visits')
    return {
      todayCount:       all.filter(v => v.visitDate === today).length,
      followupToday:    all.filter(v => v.followUpDate === today).length,
      followupTomorrow: all.filter(v => v.followUpDate === tomorrow).length,
      recent: all
        .sort((a, b) => new Date(b.visitDate) - new Date(a.visitDate))
        .slice(0, 5),
    }
  },
}
