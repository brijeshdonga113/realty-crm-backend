import { dataStore } from '@/lib/dataStore'

let _counter = 0
function uid() {
  return `lead-${Date.now().toString(36)}-${(++_counter).toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

const COLLECTION = 'leads'

export const leadService = {
  subscribe(callback) {
    return dataStore.subscribe(COLLECTION, (items) => {
      callback(items.sort((a, b) => (b.createdAt ?? '') > (a.createdAt ?? '') ? 1 : -1))
    })
  },

  async create(data) {
    const now = new Date().toISOString()
    const lead = {
      id:        data.id ?? uid(),
      name:      data.name ?? '',
      phone:     data.phone ?? '',
      email:     data.email ?? '',
      source:    data.source ?? 'walk-in',  // 'walk-in' | 'referral' | 'booking' | 'other'
      note:      data.note ?? '',
      status:    'new',                       // 'new' | 'converted' | 'lost'
      createdAt: now,
    }
    return dataStore.create(COLLECTION, lead)
  },

  async convert(id) {
    return dataStore.update(COLLECTION, id, { status: 'converted' })
  },

  async remove(id) {
    return dataStore.remove(COLLECTION, id)
  },
}
