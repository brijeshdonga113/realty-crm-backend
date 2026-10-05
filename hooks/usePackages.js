'use client'
import { useState, useEffect, useCallback } from 'react'
import { packageService } from '@/services/packageService'
import { dataStore } from '@/lib/dataStore'
import { useAuth } from '@/context/AuthContext'

export function usePackageTemplates() {
  const { doctor } = useAuth()
  const [templates, setTemplates] = useState([])
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    if (!doctor) return
    setLoading(true)
    const unsub = dataStore.subscribe('packageTemplates', (data) => {
      setTemplates(data.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '')))
      setLoading(false)
    })
    return () => unsub()
  }, [doctor])

  const add = useCallback(async (data) => {
    return packageService.createTemplate({ ...data, doctorId: doctor?.id })
  }, [doctor])

  const update = useCallback(async (id, patch) => {
    return packageService.updateTemplate(id, patch)
  }, [])

  const remove = useCallback(async (id) => {
    return packageService.removeTemplate(id)
  }, [])

  return { templates, loading, add, update, remove }
}

export function usePatientPackages() {
  const { doctor } = useAuth()
  const [packages, setPackages] = useState([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    if (!doctor) return
    setLoading(true)
    const unsub = dataStore.subscribe('patientPackages', (data) => {
      setPackages(data.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')))
      setLoading(false)
    })
    return () => unsub()
  }, [doctor])

  const add = useCallback(async (data) => {
    return packageService.createEnrollment({ ...data, doctorId: doctor?.id })
  }, [doctor])

  const update = useCallback(async (id, patch) => {
    return packageService.updateEnrollment(id, patch)
  }, [])

  const markInstallment = useCallback(async (id, installmentId, payment) => {
    return packageService.markInstallment(id, installmentId, payment)
  }, [])

  const unmarkInstallment = useCallback(async (id, installmentId) => {
    return packageService.unmarkInstallment(id, installmentId)
  }, [])

  const cancel = useCallback(async (id) => {
    return packageService.cancelEnrollment(id)
  }, [])

  const remove = useCallback(async (id) => {
    return packageService.removeEnrollment(id)
  }, [])

  return { packages, loading, add, update, markInstallment, unmarkInstallment, cancel, remove }
}

export function usePatientPackagesFor(patientId) {
  const { doctor } = useAuth()
  const [packages, setPackages] = useState([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    if (!patientId || !doctor) return
    setLoading(true)
    const unsub = dataStore.subscribeWhere('patientPackages', 'patientId', '==', patientId, (data) => {
      setPackages(data.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')))
      setLoading(false)
    })
    return () => unsub()
  }, [patientId, doctor])

  return { packages, loading }
}
