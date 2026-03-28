'use client'

import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [doctor, setDoctor] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Load saved session from localStorage (will be replaced with Firebase Auth later)
    try {
      const saved = localStorage.getItem('clinic_crm_doctor')
      if (saved) setDoctor(JSON.parse(saved))
    } catch {
      // ignore
    }
    setLoading(false)
  }, [])

  const signup = (doctorData) => {
    // Store doctors in localStorage keyed by email
    const doctors = JSON.parse(localStorage.getItem('clinic_crm_doctors') || '{}')

    if (doctors[doctorData.email]) {
      throw new Error('An account with this email already exists.')
    }

    const newDoctor = {
      id: Date.now().toString(),
      firstName: doctorData.firstName,
      lastName: doctorData.lastName,
      email: doctorData.email,
      specialization: doctorData.specialization,
      licenseNumber: doctorData.licenseNumber,
      phone: doctorData.phone,
      clinicName: doctorData.clinicName || '',
      createdAt: new Date().toISOString(),
    }

    doctors[doctorData.email] = {
      ...newDoctor,
      passwordHash: btoa(doctorData.password), // simple encode — replace with Firebase Auth later
    }

    localStorage.setItem('clinic_crm_doctors', JSON.stringify(doctors))
    localStorage.setItem('clinic_crm_doctor', JSON.stringify(newDoctor))
    setDoctor(newDoctor)
    return newDoctor
  }

  const login = (email, password) => {
    const doctors = JSON.parse(localStorage.getItem('clinic_crm_doctors') || '{}')
    const found = doctors[email]

    if (!found || found.passwordHash !== btoa(password)) {
      throw new Error('Invalid email or password.')
    }

    const { passwordHash, ...doctorData } = found
    localStorage.setItem('clinic_crm_doctor', JSON.stringify(doctorData))
    setDoctor(doctorData)
    return doctorData
  }

  const logout = () => {
    localStorage.removeItem('clinic_crm_doctor')
    setDoctor(null)
  }

  return (
    <AuthContext.Provider value={{ doctor, loading, signup, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
