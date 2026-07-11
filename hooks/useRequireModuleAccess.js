'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'

// Redirects a receptionist/staff account away from a module page they
// haven't been granted access to (Inventory/Billing/Expenses/Reports).
// Doctors always pass. Call at the top of a page component:
//   useRequireModuleAccess('inventory')
export function useRequireModuleAccess(moduleKey) {
  const router = useRouter()
  const { doctor, isReceptionist, loading } = useAuth()

  useEffect(() => {
    if (loading) return
    if (isReceptionist && doctor?.permissions?.[moduleKey] !== true) {
      router.replace('/dashboard')
    }
  }, [doctor, isReceptionist, loading, moduleKey, router])
}
