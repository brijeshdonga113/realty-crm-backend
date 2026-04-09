import { dataStore } from '@/lib/dataStore'
import { createFollowUp } from '@/models/FollowUp'
import { notificationService } from './notificationService'
import { NOTIFICATION_TYPES } from '@/models/Notification'

async function getVisitFollowUpDates() {
  try {
    const visits = await dataStore.getAllGroup('visits')
    return visits.filter(v => v.followUpDate).map(v => v.followUpDate)
  } catch { return [] }
}

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

    // Fire-and-forget — never let notification failure block follow-up creation
    notificationService.create({
      type:  NOTIFICATION_TYPES.FOLLOW_UP_DUE,
      title: `Follow-up: ${saved.patientName}`,
      body:  `${saved.note || 'Scheduled follow-up'} — due on ${saved.dueDate}`,
      relatedEntity: { type: 'followup', id: saved.id },
    }).catch(() => {})

    return saved
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
    const twoDays  = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10)
    const [standalone, visitDates] = await Promise.all([
      dataStore.getAll(COLLECTION),
      getVisitFollowUpDates(),
    ])
    const pending = standalone.filter(f => f.status === 'pending')

    // Merge both sources for accurate counts
    const allDates = [
      ...pending.map(f => f.dueDate),
      ...visitDates,
    ]

    return {
      todayCount:     allDates.filter(d => d === today).length,
      tomorrowCount:  allDates.filter(d => d === tomorrow).length,
      twoDaysCount:   allDates.filter(d => d === twoDays).length,
      overdueCount:   allDates.filter(d => d < today).length,
      upcomingCount:  allDates.filter(d => d > tomorrow).length,
      total:          allDates.length,
    }
  },
}
