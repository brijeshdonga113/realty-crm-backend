import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/context/AuthContext'
import { inventoryService } from '@/services/inventoryService'

export function useInventory() {
  const { doctor } = useAuth()
  const [items,   setItems]   = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!doctor) return
    setLoading(true)
    const unsub = inventoryService.subscribe(data => {
      setItems(data)
      setLoading(false)
    })
    return unsub
  }, [doctor])

  const create     = useCallback((data) => inventoryService.create(data), [])
  const update     = useCallback((id, patch) => inventoryService.update(id, patch), [])
  const adjustQty  = useCallback((id, delta) => inventoryService.adjustQty(id, delta), [])
  const remove     = useCallback((id) => inventoryService.remove(id), [])
  const bulkCreate = useCallback((data) => inventoryService.bulkCreate(data), [])

  return { items, loading, create, update, adjustQty, remove, bulkCreate }
}
