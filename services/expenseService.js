import { dataStore } from '@/lib/dataStore'

const COLLECTION = 'expenses'

export const expenseService = {
  async getAll() {
    const expenses = await dataStore.getAll(COLLECTION)
    return expenses.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
  },

  async create(data) {
    return dataStore.create(COLLECTION, {
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
