'use client'

import { createContext, useContext, useState, useEffect } from 'react'
import { auth, db } from '@/lib/firebase'
import { restoreGoogleCalendarConnection } from '@/lib/googleCalendar'
import { initTrial } from '@/lib/subscription'
import { getDefaultFields } from '@/lib/patientIntakePresets'

const AuthContext = createContext(null)

// Profile lives at users/{uid}/profile/doctor
const profileDocPath = (uid) => ['users', uid, 'profile', 'doctor']

// Prevents onAuthStateChanged from overwriting the session during signup
// (race: the auth event fires before the Firestore record is written)
let _suppressNextAuthEvent = false

function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 16 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

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
    subscription:  data.subscription  ?? null,
    inviteCode:    data.inviteCode    ?? '',
    bookingSlug:   data.bookingSlug   ?? '',
    workingHours:  data.workingHours  ?? null,
    logoUrl:       data.logoUrl       ?? '',
    waTemplates:   data.waTemplates   ?? null,
    inventoryCustomFields: data.inventoryCustomFields ?? [],
    patientFormFields:     data.patientFormFields     ?? [],
    createdAt:     data.createdAt     ?? new Date().toISOString(),
  }
}

// Strip `id` and internal `_*` fields before writing to Firestore
function toFirestoreProfile(profile) {
  const { id, ...rest } = profile
  return Object.fromEntries(Object.entries(rest).filter(([k]) => !k.startsWith('_')))
}

// Session cache — synchronous reads for components that need doctor data immediately
function saveSessionLocally(doctor) {
  try { localStorage.setItem('clinic_crm_doctor', JSON.stringify(doctor)) } catch {}
}
function clearSessionLocally() {
  try { localStorage.removeItem('clinic_crm_doctor') } catch {}
}
function getLocalSession() {
  try { return JSON.parse(localStorage.getItem('clinic_crm_doctor') ?? 'null') } catch { return null }
}

async function loadFirebaseProfile(uid) {
  const { doc, getDoc, setDoc } = await import('firebase/firestore')

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

// Personal preference fields stored per-user (not shared with the clinic profile)
const PERSONAL_PREF_FIELDS = new Set(['colorTheme', 'darkMode', 'dateFormat', 'currency'])

async function loadReceptionistSession(uid, userEmail) {
  const { doc, getDoc } = await import('firebase/firestore')
  const recSnap = await getDoc(doc(db, 'receptionists', uid))
  if (!recSnap.exists()) return null
  const { name, email, doctorId, ...recData } = recSnap.data()
  const doctorProfile = await loadFirebaseProfile(doctorId)
  if (!doctorProfile) return null

  // Overlay the receptionist's own stored preferences (colorTheme, darkMode, dateFormat, currency)
  // over the doctor's profile values so each user gets their own UI settings.
  const ownPrefs = Object.fromEntries(
    Object.entries(recData).filter(([k]) => PERSONAL_PREF_FIELDS.has(k))
  )

  return {
    ...doctorProfile,
    ...ownPrefs,
    _role: 'receptionist',
    _receptionistUid: uid,
    _receptionistName: name,
    _receptionistEmail: email ?? userEmail,
  }
}

export function AuthProvider({ children }) {
  // Hydrate from localStorage immediately so the app renders without a login flash.
  // Firebase onAuthStateChanged then validates and refreshes the session in the background.
  const [doctor, setDoctor]   = useState(() => typeof window !== 'undefined' ? getLocalSession() : null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let unsubscribe
    import('firebase/auth').then(({ onAuthStateChanged }) => {
      unsubscribe = onAuthStateChanged(auth, async (user) => {
        // Skip if signup is in progress — the signup function handles setDoctor itself
        if (_suppressNextAuthEvent) {
          _suppressNextAuthEvent = false
          return
        }
        if (user) {
          try {
            // Doctor profile check first — existing doctors always have this
            const profile = await loadFirebaseProfile(user.uid)
            if (profile) {
              restoreGoogleCalendarConnection(profile.googleCalendarConnected)
              saveSessionLocally(profile)
              setDoctor(profile)
            } else {
              // No doctor profile — check if this is a receptionist account
              const recSession = await loadReceptionistSession(user.uid, user.email)
              if (recSession) {
                restoreGoogleCalendarConnection(recSession.googleCalendarConnected)
                saveSessionLocally(recSession)
                setDoctor(recSession)
              } else {
                // Fallback: new doctor (e.g. Google sign-in) with no stored profile yet
                const resolved = buildDoctorProfile(user.uid, {
                  email:     user.email,
                  firstName: user.displayName?.split(' ')[0] ?? '',
                  lastName:  user.displayName?.split(' ').slice(1).join(' ') ?? '',
                })
                restoreGoogleCalendarConnection(false)
                saveSessionLocally(resolved)
                setDoctor(resolved)
              }
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
    const { createUserWithEmailAndPassword, updateProfile: fbUpdateProfile } = await import('firebase/auth')
    const { doc, setDoc } = await import('firebase/firestore')

    _suppressNextAuthEvent = true
    try {
      const cred       = await createUserWithEmailAndPassword(auth, doctorData.email, doctorData.password)
      const uid        = cred.user.uid
      const inviteCode = generateInviteCode()
      const patientFormFields = getDefaultFields(doctorData.specialization)
      const profile    = buildDoctorProfile(uid, { ...doctorData, inviteCode, subscription: initTrial(), patientFormFields })

      await setDoc(doc(db, ...profileDocPath(uid)), toFirestoreProfile(profile))
      await setDoc(doc(db, 'inviteCodes', inviteCode), { doctorId: uid, createdAt: new Date().toISOString() })
      await fbUpdateProfile(cred.user, { displayName: `${doctorData.firstName} ${doctorData.lastName}` })

      saveSessionLocally(profile)
      setDoctor(profile)
      setLoading(false)
      return profile
    } catch (err) {
      _suppressNextAuthEvent = false
      throw err
    }
  }

  const signupReceptionist = async (name, email, password, rawInviteCode) => {
    const code = rawInviteCode.replace(/\s/g, '').toUpperCase()
    const { createUserWithEmailAndPassword, updateProfile: fbUpdateProfile, deleteUser } = await import('firebase/auth')
    const { doc, getDoc, setDoc } = await import('firebase/firestore')

    // Validate invite code before touching Auth — avoids orphaned accounts
    const inviteSnap = await getDoc(doc(db, 'inviteCodes', code))
    if (!inviteSnap.exists()) throw new Error('Invalid invite code. Please check with your doctor.')
    const { doctorId } = inviteSnap.data()

    _suppressNextAuthEvent = true
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password)
      const uid  = cred.user.uid

      try {
        await fbUpdateProfile(cred.user, { displayName: name })
        await setDoc(doc(db, 'receptionists', uid), {
          name, email, doctorId, role: 'receptionist', createdAt: new Date().toISOString(),
        })
      } catch (err) {
        // Roll back the Auth account so the user can retry with the same email
        await deleteUser(cred.user).catch(() => {})
        throw err
      }

      const doctorProfile = await loadFirebaseProfile(doctorId)
      const sessionProfile = {
        ...doctorProfile,
        _role: 'receptionist',
        _receptionistUid: uid,
        _receptionistName: name,
        _receptionistEmail: email,
      }
      saveSessionLocally(sessionProfile)
      setDoctor(sessionProfile)
      setLoading(false)
      return sessionProfile
    } catch (err) {
      _suppressNextAuthEvent = false
      throw err
    }
  }

  const login = async (email, password) => {
    const { signInWithEmailAndPassword } = await import('firebase/auth')
    const cred = await signInWithEmailAndPassword(auth, email, password)
    const uid  = cred.user.uid

    // Doctor profile check first — covers all existing accounts
    const profile = await loadFirebaseProfile(uid)
    if (profile) {
      saveSessionLocally(profile)
      setDoctor(profile)
      return profile
    }

    // No doctor profile — check if this is a receptionist account
    const recSession = await loadReceptionistSession(uid, email)
    if (recSession) {
      saveSessionLocally(recSession)
      setDoctor(recSession)
      return recSession
    }

    const resolved = buildDoctorProfile(uid, { email })
    saveSessionLocally(resolved)
    setDoctor(resolved)
    return resolved
  }

  const generateReceptionistCode = async () => {
    const { doc, setDoc } = await import('firebase/firestore')
    const code = generateInviteCode()
    await setDoc(doc(db, 'inviteCodes', code), { doctorId: doctor.id, createdAt: new Date().toISOString() })
    const updated = { ...doctor, inviteCode: code }
    await setDoc(doc(db, ...profileDocPath(doctor.id)), toFirestoreProfile(updated))
    saveSessionLocally(updated)
    setDoctor(updated)
    return code
  }

  const updateProfile = async (patch) => {
    const updated = { ...doctor, ...patch }
    const { doc, setDoc } = await import('firebase/firestore')

    if (doctor._role === 'receptionist') {
      // Personal preferences (theme, format, currency) go to the receptionist's own doc.
      // Receptionists cannot modify the clinic/doctor profile.
      const personalPatch = Object.fromEntries(
        Object.entries(patch).filter(([k]) => PERSONAL_PREF_FIELDS.has(k))
      )
      if (Object.keys(personalPatch).length > 0) {
        await setDoc(
          doc(db, 'receptionists', doctor._receptionistUid),
          personalPatch,
          { merge: true }
        )
      }
      saveSessionLocally(updated)
      setDoctor(updated)
      return updated
    }

    // Doctor: write everything to the clinic profile as before
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

  const isReceptionist = doctor?._role === 'receptionist'

  return (
    <AuthContext.Provider value={{ doctor, loading, signup, signupReceptionist, login, logout, updateProfile, generateReceptionistCode, isReceptionist }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
