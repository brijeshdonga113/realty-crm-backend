import { dataStore } from '@/lib/dataStore'

const COLL = 'chat'

let _c = 0
function uid() {
  return `${Date.now().toString(36)}-${(++_c).toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

export const chatService = {
  subscribe(cb) {
    return dataStore.subscribe(COLL, msgs =>
      cb([...msgs].sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? '')))
    )
  },

  async send({ text, senderId, senderName, senderRole }) {
    return dataStore.create(COLL, {
      id: uid(),
      text: text.trim(),
      senderId,
      senderName,
      senderRole,
      readByDoctor:       senderRole === 'doctor',
      readByReceptionist: senderRole === 'receptionist',
    })
  },

  async markRead(ids, role) {
    const field = role === 'doctor' ? 'readByDoctor' : 'readByReceptionist'
    await Promise.all(ids.map(id => dataStore.update(COLL, id, { [field]: true })))
  },
}
