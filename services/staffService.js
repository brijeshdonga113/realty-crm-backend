import { dataStore } from '@/lib/dataStore'
import { createStaff } from '@/models/Staff'

const COLLECTION = 'staff'

export const staffService = {
  async getAll() {
    const staff = await dataStore.getAll(COLLECTION)
    return staff.sort((a, b) => a.firstName.localeCompare(b.firstName))
  },

  async getById(id) {
    return dataStore.getById(COLLECTION, id)
  },

  async create(data) {
    const member = createStaff(data)
    return dataStore.create(COLLECTION, member)
  },

  async update(id, patch) {
    return dataStore.update(COLLECTION, id, patch)
  },

  async remove(id) {
    return dataStore.remove(COLLECTION, id)
  },

  async getStats() {
    const all = await dataStore.getAll(COLLECTION)
    return {
      total:      all.length,
      active:     all.filter(s => s.status === 'active').length,
      onLeave:    all.filter(s => s.status === 'on_leave').length,
      terminated: all.filter(s => s.status === 'terminated').length,
    }
  },
}
