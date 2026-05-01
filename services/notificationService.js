import { dataStore } from '@/lib/dataStore'
import { createNotification } from '@/models/Notification'

const COLLECTION = 'notifications'

export const notificationService = {
  async getAll() {
    const items = await dataStore.getAll(COLLECTION)
    return items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  },

  async getUnread() {
    return dataStore.query(COLLECTION, n => !n.read)
  },

  async getUnreadCount() {
    const unread = await dataStore.query(COLLECTION, n => !n.read)
    return unread.length
  },

  async create(data) {
    let createdByRole = 'doctor'
    let createdByUid  = null
    try {
      const session = JSON.parse(localStorage.getItem('clinic_crm_doctor') ?? 'null')
      if (session?._role === 'receptionist') {
        createdByRole = 'receptionist'
        createdByUid  = session._receptionistUid ?? null
      } else {
        createdByUid = session?.id ?? null
      }
    } catch {}
    const notification = createNotification({ ...data, createdByRole, createdByUid })
    return dataStore.create(COLLECTION, notification)
  },

  async markRead(id) {
    return dataStore.update(COLLECTION, id, { read: true })
  },

  async markAllRead() {
    const unread = await dataStore.query(COLLECTION, n => !n.read)
    await Promise.all(unread.map(n => dataStore.update(COLLECTION, n.id, { read: true })))
  },

  async remove(id) {
    return dataStore.remove(COLLECTION, id)
  },
}
