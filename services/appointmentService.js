import { dataStore } from '@/lib/dataStore'
import { createAppointment } from '@/models/Appointment'
import { notificationService } from './notificationService'
import { NOTIFICATION_TYPES } from '@/models/Notification'
import {
  isGoogleCalendarEnabled,
  isGoogleCalendarConnected,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
} from '@/lib/googleCalendar'

const COLLECTION = 'appointments'

// Fire-and-forget Google Calendar sync — never blocks the main action
async function gcalSync(fn) {
  if (typeof window === 'undefined' || !isGoogleCalendarEnabled) return
  if (!isGoogleCalendarConnected()) return  // user hasn't authorized — skip silently
  try {
    await fn()
  } catch (e) {
    console.warn('Google Calendar sync failed:', e.message)
  }
}

export const appointmentService = {
  async getAll() {
    const appts = await dataStore.getAll(COLLECTION)
    return appts.sort((a, b) => {
      const da = new Date(`${a.date}T${a.time || '00:00'}`)
      const db = new Date(`${b.date}T${b.time || '00:00'}`)
      return db - da
    })
  },

  async getById(id) {
    return dataStore.getById(COLLECTION, id)
  },

  async getForPatient(patientId) {
    return dataStore.query(COLLECTION, a => a.patientId === patientId)
  },

  async getForDate(dateStr) {
    return dataStore.query(COLLECTION, a => a.date === dateStr)
  },

  async getForMonth(year, month) {
    const prefix = `${year}-${String(month).padStart(2, '0')}`
    return dataStore.query(COLLECTION, a => a.date.startsWith(prefix))
  },

  async getUpcoming(limit = 10) {
    const today = new Date().toISOString().slice(0, 10)
    const all = await dataStore.query(COLLECTION, a =>
      a.date >= today && a.status !== 'cancelled' && a.status !== 'completed'
    )
    return all
      .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`))
      .slice(0, limit)
  },

  async getTodayCount() {
    const today = new Date().toISOString().slice(0, 10)
    const list = await dataStore.query(COLLECTION, a => a.date === today)
    return list.length
  },

  async create(data) {
    const appt = createAppointment(data)
    const saved = await dataStore.create(COLLECTION, appt)

    notificationService.create({
      type:  NOTIFICATION_TYPES.APPOINTMENT_NEW,
      title: 'Appointment scheduled',
      body:  `${saved.patientName} — ${saved.date} at ${saved.time}`,
      relatedEntity: { type: 'appointment', id: saved.id },
    }).catch(() => {})

    // Sync to Google Calendar
    gcalSync(async () => {
      const googleEventId = await createCalendarEvent(saved)
      if (googleEventId) await dataStore.update(COLLECTION, saved.id, { googleEventId })
    })

    return saved
  },

  async update(id, patch) {
    const existing = await dataStore.getById(COLLECTION, id)
    const updated  = await dataStore.update(COLLECTION, id, patch)

    // Sync update to Google Calendar
    gcalSync(async () => {
      if (updated.googleEventId) await updateCalendarEvent(updated.googleEventId, updated)
    })

    return updated
  },

  async remove(id) {
    const appt = await dataStore.getById(COLLECTION, id)
    gcalSync(async () => {
      if (appt?.googleEventId) await deleteCalendarEvent(appt.googleEventId)
    })
    return dataStore.remove(COLLECTION, id)
  },

  // Backfill all appointments that are missing a googleEventId
  async syncAllToGoogleCalendar(onProgress) {
    const all = await dataStore.getAll(COLLECTION)
    const pending = all.filter(a => !a.googleEventId && a.status !== 'cancelled')
    let synced = 0
    let failed = 0
    for (const appt of pending) {
      try {
        const googleEventId = await createCalendarEvent(appt)
        if (googleEventId) {
          await dataStore.update(COLLECTION, appt.id, { googleEventId })
          synced++
        }
      } catch {
        failed++
      }
      if (onProgress) onProgress({ synced, failed, total: pending.length })
    }
    return { synced, failed, total: pending.length }
  },

  async getStats() {
    const all   = await dataStore.getAll(COLLECTION)
    const today = new Date().toISOString().slice(0, 10)
    const todayCount     = all.filter(a => a.date === today).length
    const completedCount = all.filter(a => a.status === 'completed').length
    const noShowCount    = all.filter(a => a.status === 'no_show').length
    const upcomingCount  = all.filter(a => a.date >= today && a.status === 'scheduled').length
    return { total: all.length, todayCount, completedCount, noShowCount, upcomingCount }
  },
}
