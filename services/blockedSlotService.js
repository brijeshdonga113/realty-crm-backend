import { dataStore } from '@/lib/dataStore'
import { createBlockedSlot } from '@/models/BlockedSlot'

const COLLECTION = 'blockedSlots'

export const blockedSlotService = {
  subscribe(callback) {
    return dataStore.subscribe(COLLECTION, callback)
  },
  async create(data) {
    const slot = createBlockedSlot(data)
    return dataStore.create(COLLECTION, slot)
  },
  async remove(id) {
    return dataStore.remove(COLLECTION, id)
  },
}
