import { dataStore } from '@/lib/dataStore'
import { createFollowUp } from '@/models/FollowUp'
import { notificationService } from './notificationService'
import { NOTIFICATION_TYPES } from '@/models/Notification'

const COLLECTION = 'followups'

export const followupService = {
  async getAll() {
    const items = await dataStore.getAll(COLLECTION)
    return items.sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  },

  subscribe(callback) {
    return dataStore.subscribe(COLLECTION, (items) => {
      callback(items.sort((a, b) => a.dueDate.localeCompare(b.dueDate)))
    })
  },

  async create(data) {
    const followup = createFollowUp(data)

    // Create the follow-up record first
    const saved = await dataStore.create(COLLECTION, followup)

    // Create a notification linked back to this follow-up
    const notification = await notificationService.create({
      type:  NOTIFICATION_TYPES.FOLLOW_UP_DUE,
      title: `Follow-up: ${saved.patientName}`,
      body:  `${saved.note || 'Scheduled follow-up'} — due on ${saved.dueDate}`,
      relatedEntity: { type: 'followup', id: saved.id },
    })

    // Store notification id on the follow-up for cross-reference
    await dataStore.update(COLLECTION, saved.id, { notificationId: notification.id })

    return { ...saved, notificationId: notification.id }
  },

  async markDone(id) {
    const updated = await dataStore.update(COLLECTION, id, { status: 'done' })
    return updated
  },

  async remove(id) {
    return dataStore.remove(COLLECTION, id)
  },

  async getStats() {
    const today    = new Date().toISOString().slice(0, 10)
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
    const all      = await dataStore.getAll(COLLECTION)
    const pending  = all.filter(f => f.status === 'pending')
    return {
      todayCount:     pending.filter(f => f.dueDate === today).length,
      tomorrowCount:  pending.filter(f => f.dueDate === tomorrow).length,
      overdueCount:   pending.filter(f => f.dueDate < today).length,
      upcomingCount:  pending.filter(f => f.dueDate > tomorrow).length,
      total:          pending.length,
    }
  },
}
