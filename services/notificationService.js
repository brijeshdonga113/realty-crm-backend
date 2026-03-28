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
    const notification = createNotification(data)
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
