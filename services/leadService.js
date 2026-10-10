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
    const phone = data.phone ?? ''
    const lead = {
      id:            data.id ?? uid(),
      name:          data.name ?? '',
      phone,
      phoneKey:      data.phoneKey ?? phone.replace(/\D/g, '').slice(-10),
      email:         data.email ?? '',
      source:        data.source ?? 'walk-in',
      note:          data.note ?? '',
      status:        'new',
      lastMessage:   data.lastMessage ?? '',
      lastMessageAt: data.lastMessageAt ?? null,
      unreadCount:   data.unreadCount ?? 0,
      waThreadId:    data.waThreadId ?? null,
      createdAt:     now,
    }
    return dataStore.create(COLLECTION, lead)
  },

  async update(id, patch) {
    return dataStore.update(COLLECTION, id, patch)
  },

  async convert(id) {
    return dataStore.update(COLLECTION, id, { status: 'converted' })
  },

  async remove(id) {
    return dataStore.remove(COLLECTION, id)
  },
}
