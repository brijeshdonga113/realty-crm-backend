import { dataStore } from '@/lib/dataStore'
import { createFollowUp } from '@/models/FollowUp'
import {
  isGoogleCalendarEnabled,
  isGoogleCalendarConnected,
  createFollowUpEvent,
  updateFollowUpEvent,
  deleteCalendarEvent,
} from '@/lib/googleCalendar'

async function gcalSync(fn) {
  if (typeof window === 'undefined' || !isGoogleCalendarEnabled) return
  if (!isGoogleCalendarConnected()) return
  try { await fn() } catch (e) { console.warn('GCal follow-up sync failed:', e.message) }
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
    const saved = await dataStore.create(COLLECTION, followup)

    // Sync to Google Calendar
    gcalSync(async () => {
      const googleEventId = await createFollowUpEvent(saved)
      if (googleEventId) await dataStore.update(COLLECTION, saved.id, { googleEventId })
    })

    return saved
  },

  async getByVisitId(visitId) {
    const all = await dataStore.getAll(COLLECTION)
    return all.find(f => f.visitId === visitId) ?? null
  },

  async update(id, patch) {
    const updated = await dataStore.update(COLLECTION, id, patch)
    gcalSync(async () => {
      if (updated.googleEventId) await updateFollowUpEvent(updated.googleEventId, updated)
    })
    return updated
  },

  async markDone(id) {
    const updated = await dataStore.update(COLLECTION, id, { status: 'done' })
    // Remove from calendar when marked done
    gcalSync(async () => {
      if (updated.googleEventId) await deleteCalendarEvent(updated.googleEventId)
    })
    return updated
  },

  async remove(id) {
    const existing = await dataStore.getById(COLLECTION, id)
    gcalSync(async () => {
      if (existing?.googleEventId) await deleteCalendarEvent(existing.googleEventId)
    })
    return dataStore.remove(COLLECTION, id)
  },

  async getStats() {
    const today    = new Date().toISOString().slice(0, 10)
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
    const twoDays  = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10)
    const all = await dataStore.getAll(COLLECTION)
    const pending = all.filter(f => f.status === 'pending')
    const dates = pending.map(f => f.dueDate)

    return {
      todayCount:     dates.filter(d => d === today).length,
      tomorrowCount:  dates.filter(d => d === tomorrow).length,
      twoDaysCount:   dates.filter(d => d === twoDays).length,
      overdueCount:   dates.filter(d => d < today).length,
      upcomingCount:  dates.filter(d => d > tomorrow).length,
      total:          dates.length,
    }
  },
}
