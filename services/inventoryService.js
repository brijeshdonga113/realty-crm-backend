import { dataStore } from '@/lib/dataStore'

const COLLECTION = 'inventory'

let _counter = 0
function uid() {
  return `${Date.now().toString(36)}-${(++_counter).toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export function createInventoryItem(data = {}) {
  const now = new Date().toISOString()
  return {
    id:               data.id ?? uid(),
    name:             data.name ?? '',
    generic:          data.generic ?? '',
    potency:          data.potency ?? '',
    dosageForm:       data.dosageForm ?? '',
    category:         data.category ?? '',
    quantity:         Number(data.quantity) || 0,
    unit:             data.unit ?? '',
    mrp:          data.mrp          ?? '',
    billingPrice: data.billingPrice ?? '',
    expiry:       data.expiry       ?? '',
    batch:            data.batch ?? '',
    supplier:         data.supplier ?? '',
    lowStockThreshold: Number(data.lowStockThreshold) || 10,
    notes:            data.notes ?? '',
    customFields:     data.customFields ?? {},
    createdAt:        data.createdAt ?? now,
  }
}

export const inventoryService = {
  subscribe(cb) {
    return dataStore.subscribe(COLLECTION, items =>
      cb(items.sort((a, b) => a.name.localeCompare(b.name)))
    )
  },

  async create(data) {
    const item = createInventoryItem(data)
    return dataStore.create(COLLECTION, item)
  },

  async update(id, patch) {
    return dataStore.update(COLLECTION, id, patch)
  },

  async adjustQty(id, delta) {
    const item = await dataStore.getById(COLLECTION, id)
    if (!item) return null
    const newQty = Math.max(0, (item.quantity ?? 0) + delta)
    return dataStore.update(COLLECTION, id, { quantity: newQty })
  },

  async remove(id) {
    return dataStore.remove(COLLECTION, id)
  },

  async bulkCreate(items) {
    return Promise.all(items.map(item => this.create(item)))
  },
}
