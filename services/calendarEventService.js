import { dataStore } from '@/lib/dataStore'
import { createCalendarEvent } from '@/models/CalendarEvent'

const COLLECTION = 'calendarEvents'

export const calendarEventService = {
  subscribe(callback) {
    return dataStore.subscribe(COLLECTION, callback)
  },
  async create(data) {
    const event = createCalendarEvent(data)
    return dataStore.create(COLLECTION, event)
  },
  async update(id, patch) {
    return dataStore.update(COLLECTION, id, patch)
  },
  async remove(id) {
    return dataStore.remove(COLLECTION, id)
  },
}
