import { dataStore } from '@/lib/dataStore'

const COLLECTION = 'expenses'

let _c = 0
function uid() {
  return `${Date.now().toString(36)}-${(++_c).toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export const expenseService = {
  async getAll() {
    const expenses = await dataStore.getAll(COLLECTION)
    return expenses.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
  },

  async create(data) {
    return dataStore.create(COLLECTION, {
      id: uid(),
      ...data,
      createdAt: new Date().toISOString(),
    })
  },

  async update(id, patch) {
    return dataStore.update(COLLECTION, id, patch)
  },

  async remove(id) {
    return dataStore.remove(COLLECTION, id)
  },
}
