'use client'

import { createContext, useContext, useState, useEffect } from 'react'
import { auth, db } from '@/lib/firebase'

const AuthContext = createContext(null)

/* ─── helpers ─── */

function buildDoctorProfile(uid, data) {
  return {
    id:             uid,
    firstName:      data.firstName      ?? '',
    lastName:       data.lastName       ?? '',
    email:          data.email          ?? '',
    specialization: data.specialization ?? '',
    licenseNumber:  data.licenseNumber  ?? '',
    phone:          data.phone          ?? '',
    clinicName:     data.clinicName     ?? '',
    colorTheme:     data.colorTheme     ?? null,   // persisted theme preference
    darkMode:       data.darkMode       ?? null,   // persisted dark/light preference
    createdAt:      data.createdAt      ?? new Date().toISOString(),
  }
}

function saveSessionLocally(doctor) {
  // Keep a local copy so other parts of the app can read it synchronously
  localStorage.setItem('clinic_crm_doctor', JSON.stringify(doctor))
}

function clearSessionLocally() {
  localStorage.removeItem('clinic_crm_doctor')
}

/* ─── Firebase implementation ─── */

async function firebaseSignup(doctorData) {
  const { createUserWithEmailAndPassword, updateProfile } = await import('firebase/auth')
  const { doc, setDoc } = await import('firebase/firestore')

  const cred = await createUserWithEmailAndPassword(
    auth,
    doctorData.email,
    doctorData.password
  )

  const uid     = cred.user.uid
  const profile = buildDoctorProfile(uid, doctorData)

  // Store doctor profile directly on the root users/{uid} document
  await setDoc(doc(db, 'users', uid), profile)

  await updateProfile(cred.user, {
    displayName: `${doctorData.firstName} ${doctorData.lastName}`,
  })

  saveSessionLocally(profile)
  return profile
}

async function firebaseLogin(email, password) {
  const { signInWithEmailAndPassword } = await import('firebase/auth')
  const { doc, getDoc, setDoc } = await import('firebase/firestore')

  const cred = await signInWithEmailAndPassword(auth, email, password)
  const uid  = cred.user.uid

  // Try root document first (new path)
  let snap = await getDoc(doc(db, 'users', uid))
  if (!snap.exists()) {
    // Migrate from old nested path: users/{uid}/profile/doctor
    snap = await getDoc(doc(db, 'users', uid, 'profile', 'doctor'))
    if (snap.exists()) {
      // Migrate to root document
      await setDoc(doc(db, 'users', uid), snap.data())
    }
  }

  const profile = snap.exists()
    ? buildDoctorProfile(uid, snap.data())
    : buildDoctorProfile(uid, { email })

  saveSessionLocally(profile)
  return profile
}

async function firebaseLogout() {
  const { signOut } = await import('firebase/auth')
  await signOut(auth)
  clearSessionLocally()
}

async function loadFirebaseProfile(uid) {
  const { doc, getDoc, setDoc } = await import('firebase/firestore')

  // Try root document first (new path)
  let snap = await getDoc(doc(db, 'users', uid))
  if (!snap.exists()) {
    // Migrate from old nested path: users/{uid}/profile/doctor
    snap = await getDoc(doc(db, 'users', uid, 'profile', 'doctor'))
    if (snap.exists()) {
      // Migrate to root document so admin panel and isAdmin flag work
      await setDoc(doc(db, 'users', uid), snap.data())
    }
  }
  return snap.exists() ? buildDoctorProfile(uid, snap.data()) : null
}

/* ─── localStorage implementation (dev fallback) ─── */

function localSignup(doctorData) {
  const doctors = JSON.parse(localStorage.getItem('clinic_crm_doctors') || '{}')
  if (doctors[doctorData.email]) {
    throw new Error('An account with this email already exists.')
  }
  const profile = buildDoctorProfile(Date.now().toString(), doctorData)
  doctors[doctorData.email] = { ...profile, passwordHash: btoa(doctorData.password) }
  localStorage.setItem('clinic_crm_doctors', JSON.stringify(doctors))
  saveSessionLocally(profile)
  return profile
}

function localLogin(email, password) {
  const doctors = JSON.parse(localStorage.getItem('clinic_crm_doctors') || '{}')
  const found   = doctors[email]
  if (!found || found.passwordHash !== btoa(password)) {
    throw new Error('Invalid email or password.')
  }
  const { passwordHash, ...profile } = found
  saveSessionLocally(profile)
  return profile
}

function localLogout() {
  clearSessionLocally()
}

/* ─── Provider ─── */

export function AuthProvider({ children }) {
  const [doctor, setDoctor]   = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let unsubscribe
    import('firebase/auth').then(({ onAuthStateChanged }) => {
      unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (user) {
          try {
            const profile = await loadFirebaseProfile(user.uid)
            if (profile) {
              saveSessionLocally(profile)
              setDoctor(profile)
            } else {
              const fallback = buildDoctorProfile(user.uid, {
                email: user.email,
                firstName: user.displayName?.split(' ')[0] ?? '',
                lastName:  user.displayName?.split(' ').slice(1).join(' ') ?? '',
              })
              setDoctor(fallback)
            }
          } catch {
            setDoctor(null)
          }
        } else {
          clearSessionLocally()
          setDoctor(null)
        }
        setLoading(false)
      })
    })
    return () => unsubscribe?.()
  }, [])

  const signup = async (doctorData) => {
    const profile = await firebaseSignup(doctorData)
    setDoctor(profile)
    return profile
  }

  const login = async (email, password) => {
    const profile = await firebaseLogin(email, password)
    setDoctor(profile)
    return profile
  }

  const updateProfile = async (patch) => {
    const updated = { ...doctor, ...patch }
    if (db) {
      const { doc, setDoc } = await import('firebase/firestore')
      await setDoc(doc(db, 'users', doctor.id), updated)
      const { updateProfile: fbUpdateProfile } = await import('firebase/auth')
      if (auth.currentUser) {
        await fbUpdateProfile(auth.currentUser, {
          displayName: `${updated.firstName} ${updated.lastName}`,
        })
      }
    } else {
      const doctors = JSON.parse(localStorage.getItem('clinic_crm_doctors') || '{}')
      if (doctors[doctor.email]) {
        doctors[doctor.email] = { ...doctors[doctor.email], ...patch }
        localStorage.setItem('clinic_crm_doctors', JSON.stringify(doctors))
      }
    }
    saveSessionLocally(updated)
    setDoctor(updated)
    return updated
  }

  const logout = async () => {
    await firebaseLogout()
    setDoctor(null)
  }

  return (
    <AuthContext.Provider value={{ doctor, loading, signup, login, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
