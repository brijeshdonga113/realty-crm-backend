'use client'

import { createContext, useContext, useState, useEffect } from 'react'
import { auth, db } from '@/lib/firebase'
import { restoreGoogleCalendarConnection } from '@/lib/googleCalendar'
import { initTrial } from '@/lib/subscription'

const AuthContext = createContext(null)

// Profile lives at users/{uid}/profile/doctor
const profileDocPath = (uid) => ['users', uid, 'profile', 'doctor']

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
    colorTheme:     data.colorTheme     ?? null,
    darkMode:       data.darkMode       ?? null,
    dateFormat:         data.dateFormat         ?? 'DD/MM/YYYY',
    currency:           data.currency           ?? 'INR',
    referralSources:    data.referralSources    ?? null,
    googleCalendarConnected: data.googleCalendarConnected ?? false,
    whatsapp:     data.whatsapp     ?? null,
    subscription: data.subscription ?? null,
    createdAt:    data.createdAt    ?? new Date().toISOString(),
  }
}

// Strip `id` before writing to Firestore — it's the document path, not a field
function toFirestoreProfile(profile) {
  const { id, ...rest } = profile
  return rest
}

// Session cache — synchronous reads for components that need doctor data immediately
function saveSessionLocally(doctor) {
  try { localStorage.setItem('clinic_crm_doctor', JSON.stringify(doctor)) } catch {}
}
function clearSessionLocally() {
  try { localStorage.removeItem('clinic_crm_doctor') } catch {}
}

async function loadFirebaseProfile(uid) {
  const { doc, getDoc, setDoc, deleteField } = await import('firebase/firestore')

  // Primary: users/{uid}/profile/doctor
  const profileSnap = await getDoc(doc(db, ...profileDocPath(uid)))
  if (profileSnap.exists()) {
    return buildDoctorProfile(uid, profileSnap.data())
  }

  // Migrate from old flat path users/{uid} if it has profile data
  const flatSnap = await getDoc(doc(db, 'users', uid))
  if (flatSnap.exists() && flatSnap.data().firstName) {
    const { id: _id, ...profileData } = flatSnap.data()
    await setDoc(doc(db, ...profileDocPath(uid)), profileData)
    return buildDoctorProfile(uid, profileData)
  }

  return null
}

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
            const resolved = profile ?? buildDoctorProfile(user.uid, {
              email:     user.email,
              firstName: user.displayName?.split(' ')[0] ?? '',
              lastName:  user.displayName?.split(' ').slice(1).join(' ') ?? '',
            })
            // Restore Google Calendar connection flag from profile
            restoreGoogleCalendarConnection(resolved.googleCalendarConnected)
            saveSessionLocally(resolved)
            setDoctor(resolved)
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
    const { createUserWithEmailAndPassword, updateProfile: fbUpdateProfile } = await import('firebase/auth')
    const { doc, setDoc } = await import('firebase/firestore')

    const cred    = await createUserWithEmailAndPassword(auth, doctorData.email, doctorData.password)
    const uid     = cred.user.uid
    const profile = buildDoctorProfile(uid, { ...doctorData, subscription: initTrial() })

    await setDoc(doc(db, ...profileDocPath(uid)), toFirestoreProfile(profile))
    await fbUpdateProfile(cred.user, { displayName: `${doctorData.firstName} ${doctorData.lastName}` })

    saveSessionLocally(profile)
    setDoctor(profile)
    return profile
  }

  const login = async (email, password) => {
    const { signInWithEmailAndPassword } = await import('firebase/auth')
    const cred    = await signInWithEmailAndPassword(auth, email, password)
    const profile = await loadFirebaseProfile(cred.user.uid)
    const resolved = profile ?? buildDoctorProfile(cred.user.uid, { email })
    saveSessionLocally(resolved)
    setDoctor(resolved)
    return resolved
  }

  const updateProfile = async (patch) => {
    const updated = { ...doctor, ...patch }
    const { doc, setDoc } = await import('firebase/firestore')
    await setDoc(doc(db, ...profileDocPath(doctor.id)), toFirestoreProfile(updated))
    if (auth.currentUser) {
      const { updateProfile: fbUpdateProfile } = await import('firebase/auth')
      await fbUpdateProfile(auth.currentUser, {
        displayName: `${updated.firstName} ${updated.lastName}`,
      })
    }
    saveSessionLocally(updated)
    setDoctor(updated)
    return updated
  }

  const logout = async () => {
    const { signOut } = await import('firebase/auth')
    await signOut(auth)
    clearSessionLocally()
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
