'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { auth, db } from '@/lib/firebase'
import { supabase } from '@/lib/supabase'
import { restoreGoogleCalendarConnection } from '@/lib/googleCalendar'
import { initTrial } from '@/lib/subscription'
import { setActiveBranchUid, clearDataStoreCache } from '@/lib/dataStore'

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
    waTemplates:      data.waTemplates      ?? null,
    serviceCharges:   data.serviceCharges   ?? [],
    billingStatuses:  data.billingStatuses  ?? null,
    inventoryCustomFields: data.inventoryCustomFields ?? [],
    createdAt:     data.createdAt     ?? new Date().toISOString(),
    isAdmin:         data.isAdmin         ?? false,
    viewOnly:        data.viewOnly        ?? false,
    organizationId:  data.organizationId  ?? null,
    branchName:      data.branchName      ?? '',
    allowedWriters:  data.allowedWriters  ?? [],
    allowedReaders:  data.allowedReaders  ?? null,
    clinicRole:      data.clinicRole      ?? 'doctor',
    managedBy:       data.managedBy       ?? null,
    managedDoctors:  data.managedDoctors  ?? [],
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
  const { name, email, doctorId, viewOnly: recViewOnly, permissions: recPermissions, ...recData } = recSnap.data()
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
    // Per-receptionist viewOnly overrides the clinic-level flag
    viewOnly: recViewOnly ?? doctorProfile.viewOnly ?? false,
    // Per-module access toggles (Inventory/Billing/Expenses/Reports). Missing
    // key = no access — accounts created before this feature default closed.
    permissions: recPermissions ?? {},
    _role: 'receptionist',
    _receptionistUid: uid,
    _receptionistName: name,
    _receptionistEmail: email ?? userEmail,
  }
}

// ── Supabase (SB) equivalents ────────────────────────────────────────────────
// Mirror buildDoctorProfile/loadFirebaseProfile/loadReceptionistSession above,
// reading from Postgres instead of Firestore, so `doctor` has the identical
// shape regardless of which backend an account uses. Org/branch/clinic-admin
// fields are carried through for schema parity but those FEATURES are not
// wired up for SB accounts yet (see plan's scope boundary).
function buildDoctorProfileFromRow(row) {
  return {
    id:             row.id,
    firstName:      row.first_name      ?? '',
    lastName:       row.last_name       ?? '',
    email:          row.email           ?? '',
    specialization: row.specialization  ?? '',
    licenseNumber:  row.license_number  ?? '',
    phone:          row.phone           ?? '',
    clinicName:     row.clinic_name     ?? '',
    colorTheme:     row.color_theme     ?? null,
    darkMode:       row.dark_mode       ?? null,
    dateFormat:      row.date_format      ?? 'DD/MM/YYYY',
    currency:        row.currency          ?? 'INR',
    referralSources: row.referral_sources  ?? null,
    googleCalendarConnected: false,
    subscription:  row.subscription     ?? null,
    inviteCode:    row.invite_code      ?? '',
    bookingSlug:   row.booking_slug     ?? '',
    workingHours:  row.working_hours    ?? null,
    logoUrl:       row.logo_url         ?? '',
    paymentQrUrl:  row.payment_qr_url   ?? '',
    waTemplates:      row.wa_templates             ?? null,
    serviceCharges:   row.service_charges          ?? [],
    billingStatuses:  row.billing_statuses         ?? null,
    inventoryCustomFields: row.inventory_custom_fields ?? [],
    createdAt:     row.created_at       ?? new Date().toISOString(),
    isAdmin:         row.is_admin         ?? false,
    viewOnly:        row.view_only        ?? false,
    organizationId:  row.organization_id  ?? null,
    branchName:      row.branch_name      ?? '',
    allowedWriters:  row.allowed_writers  ?? [],
    allowedReaders:  row.allowed_readers  ?? null,
    clinicRole:      row.clinic_role      ?? 'doctor',
    managedBy:       row.managed_by       ?? null,
    managedDoctors:  row.managed_doctors  ?? [],
    backend: 'SB',
  }
}

async function loadSupabaseProfile(uid) {
  if (!supabase) return null
  const { data, error } = await supabase.from('doctors').select('*').eq('id', uid).maybeSingle()
  if (error || !data) return null
  return buildDoctorProfileFromRow(data)
}

async function loadSupabaseReceptionistSession(uid, userEmail) {
  if (!supabase) return null
  const { data: rec, error } = await supabase.from('receptionists').select('*').eq('id', uid).maybeSingle()
  if (error || !rec) return null
  const doctorProfile = await loadSupabaseProfile(rec.doctor_id)
  if (!doctorProfile) return null

  return {
    ...doctorProfile,
    colorTheme: rec.color_theme ?? doctorProfile.colorTheme,
    darkMode:   rec.dark_mode   ?? doctorProfile.darkMode,
    dateFormat: rec.date_format ?? doctorProfile.dateFormat,
    currency:   rec.currency    ?? doctorProfile.currency,
    viewOnly:    rec.view_only    ?? doctorProfile.viewOnly ?? false,
    permissions: rec.permissions  ?? {},
    _role: 'receptionist',
    _receptionistUid: uid,
    _receptionistName: rec.name,
    _receptionistEmail: rec.email ?? userEmail,
  }
}

// camelCase profile fields -> snake_case `doctors` table columns, for writes.
const DOCTOR_PATCH_COLUMNS = {
  firstName: 'first_name', lastName: 'last_name', email: 'email', specialization: 'specialization',
  licenseNumber: 'license_number', phone: 'phone', clinicName: 'clinic_name', colorTheme: 'color_theme',
  darkMode: 'dark_mode', dateFormat: 'date_format', currency: 'currency', referralSources: 'referral_sources',
  subscription: 'subscription', inviteCode: 'invite_code', bookingSlug: 'booking_slug', workingHours: 'working_hours',
  logoUrl: 'logo_url', paymentQrUrl: 'payment_qr_url', waTemplates: 'wa_templates', serviceCharges: 'service_charges',
  billingStatuses: 'billing_statuses', inventoryCustomFields: 'inventory_custom_fields', isAdmin: 'is_admin',
  viewOnly: 'view_only', organizationId: 'organization_id', branchName: 'branch_name',
  allowedWriters: 'allowed_writers', allowedReaders: 'allowed_readers', clinicRole: 'clinic_role',
  managedBy: 'managed_by', managedDoctors: 'managed_doctors',
}

function toDoctorRowPatch(patch) {
  return Object.fromEntries(
    Object.entries(patch)
      .filter(([k]) => DOCTOR_PATCH_COLUMNS[k])
      .map(([k, v]) => [DOCTOR_PATCH_COLUMNS[k], v])
  )
}

const RECEPTIONIST_PATCH_COLUMNS = { colorTheme: 'color_theme', darkMode: 'dark_mode', dateFormat: 'date_format', currency: 'currency' }

function toReceptionistRowPatch(patch) {
  return Object.fromEntries(
    Object.entries(patch)
      .filter(([k]) => RECEPTIONIST_PATCH_COLUMNS[k])
      .map(([k, v]) => [RECEPTIONIST_PATCH_COLUMNS[k], v])
  )
}

export function AuthProvider({ children }) {
  // Hydrate from localStorage immediately so the app renders without a login flash.
  // Firebase onAuthStateChanged then validates and refreshes the session in the background.
  const [doctor,         setDoctor]         = useState(() => typeof window !== 'undefined' ? getLocalSession() : null)
  const [loading,        setLoading]        = useState(true)
  // Multi-branch org state
  const [baseDoctor,     setBaseDoctor]     = useState(null) // always the logged-in user's profile
  const [activeBranch,   setActiveBranchState] = useState(null) // { uid, branchName }
  const [org,            setOrg]            = useState(null) // { id, name, branches: [{uid, branchName}] }
  // Clinic admin: list of managed doctor profiles + which one is currently active
  const [managedDoctors,       setManagedDoctors]       = useState([])
  const [activeManagedDoctor,  setActiveManagedDoctor]  = useState(null)

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
              setBaseDoctor(profile)
              loadOrg(profile, profile)
              loadManagedDoctors(profile)
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
        } else if (getLocalSession()?.backend !== 'SB') {
          // No Firebase user — but this browser may be authenticated via
          // Supabase instead, which is expected/normal (Firebase's listener
          // always fires once even for an SB-only session). Only clear the
          // session here if it isn't an SB one; the Supabase effect below
          // owns validating/clearing SB sessions.
          clearSessionLocally()
          setDoctor(null)
        }
        setLoading(false)
      })
    })
    return () => unsubscribe?.()
  }, [])

  // Parallel session-resolution for Supabase (SB) accounts — mirrors the
  // Firebase effect above. Org/branch/clinic-admin loading is intentionally
  // not wired up here (deferred for SB accounts, see plan).
  useEffect(() => {
    if (!supabase) return
    let subscription
    const resolveSession = async (session) => {
      if (session?.user) {
        try {
          const profile = await loadSupabaseProfile(session.user.id)
          if (profile) {
            saveSessionLocally(profile)
            setDoctor(profile)
            setBaseDoctor(profile)
          } else {
            const recSession = await loadSupabaseReceptionistSession(session.user.id, session.user.email)
            if (recSession) {
              saveSessionLocally(recSession)
              setDoctor(recSession)
            }
          }
        } catch { /* leave existing hydrated state alone on a transient error */ }
      } else if (getLocalSession()?.backend === 'SB') {
        // Local session claimed SB but Supabase reports no active session — actually logged out
        clearSessionLocally()
        setDoctor(null)
      }
    }
    supabase.auth.getSession().then(({ data }) => resolveSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, session) => resolveSession(session))
    subscription = data.subscription
    return () => subscription?.unsubscribe()
  }, [])

  const signup = async (doctorData) => {
    const { createUserWithEmailAndPassword, updateProfile: fbUpdateProfile } = await import('firebase/auth')
    const { doc, setDoc } = await import('firebase/firestore')

    _suppressNextAuthEvent = true
    try {
      const cred       = await createUserWithEmailAndPassword(auth, doctorData.email, doctorData.password)
      const uid        = cred.user.uid
      const inviteCode = generateInviteCode()
      const profile    = buildDoctorProfile(uid, { ...doctorData, inviteCode, subscription: initTrial() })

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
    const { doc, getDoc } = await import('firebase/firestore')

    // The code alone doesn't say which backend created it — check both.
    const [fbSnap, sbRow] = await Promise.all([
      getDoc(doc(db, 'inviteCodes', code)),
      supabase ? supabase.from('invite_codes').select('*').eq('code', code).maybeSingle().then(r => r.data) : Promise.resolve(null),
    ])

    if (sbRow) {
      // Supabase's public signUp() requires email confirmation before login
      // works, unlike Firebase's immediate-login createUserWithEmailAndPassword.
      // A server route using the service-role key keeps the same immediate-
      // login UX (email_confirm: true).
      const res = await fetch('/api/join-sb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, doctorId: sbRow.doctor_id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to join.')

      const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password })
      if (signInErr) throw signInErr

      const doctorProfile = await loadSupabaseProfile(sbRow.doctor_id)
      const sessionProfile = {
        ...doctorProfile,
        _role: 'receptionist',
        _receptionistUid: data.uid,
        _receptionistName: name,
        _receptionistEmail: email,
      }
      saveSessionLocally(sessionProfile)
      setDoctor(sessionProfile)
      setLoading(false)
      return sessionProfile
    }

    if (!fbSnap.exists()) throw new Error('Invalid invite code. Please check with your doctor.')
    const { doctorId } = fbSnap.data()

    const { createUserWithEmailAndPassword, updateProfile: fbUpdateProfile, deleteUser } = await import('firebase/auth')
    const { setDoc } = await import('firebase/firestore')

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

  const login = async (email, password, backend = 'FB') => {
    if (backend === 'SB') {
      if (!supabase) throw new Error('Supabase is not configured.')
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      const uid = data.user.id

      const profile = await loadSupabaseProfile(uid)
      if (profile) {
        saveSessionLocally(profile)
        setDoctor(profile)
        setBaseDoctor(profile)
        return profile
      }

      const recSession = await loadSupabaseReceptionistSession(uid, email)
      if (recSession) {
        saveSessionLocally(recSession)
        setDoctor(recSession)
        return recSession
      }

      throw new Error('No account found for this user.')
    }

    const { signInWithEmailAndPassword } = await import('firebase/auth')
    const cred = await signInWithEmailAndPassword(auth, email, password)
    const uid  = cred.user.uid

    // Doctor profile check first — covers all existing accounts
    const profile = await loadFirebaseProfile(uid)
    if (profile) {
      saveSessionLocally(profile)
      setDoctor(profile)
      setBaseDoctor(profile)
      loadOrg(profile)
      loadManagedDoctors(profile)
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

    if (doctor.backend === 'SB') {
      if (doctor._role === 'receptionist') {
        const personalPatch = toReceptionistRowPatch(patch)
        if (Object.keys(personalPatch).length > 0) {
          await supabase.from('receptionists').update(personalPatch).eq('id', doctor._receptionistUid)
        }
        saveSessionLocally(updated)
        setDoctor(updated)
        return updated
      }

      await supabase.from('doctors').update(toDoctorRowPatch(updated)).eq('id', doctor.id)
      saveSessionLocally(updated)
      setDoctor(updated)
      return updated
    }

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

  // Persist active branch in localStorage so it survives page refreshes
  const BRANCH_KEY = 'clinic_crm_active_branch'
  const saveActiveBranch = (branch) => {
    try {
      if (branch) localStorage.setItem(BRANCH_KEY, JSON.stringify(branch))
      else localStorage.removeItem(BRANCH_KEY)
    } catch {}
  }
  const getSavedBranch = () => {
    try { return JSON.parse(localStorage.getItem(BRANCH_KEY) ?? 'null') } catch { return null }
  }

  // Load org when a doctor profile with organizationId is available,
  // then restore any previously selected branch
  const loadOrg = useCallback(async (profile, base) => {
    if (!profile?.organizationId) { setOrg(null); return }
    try {
      const { doc, getDoc } = await import('firebase/firestore')
      const snap = await getDoc(doc(db, 'organizations', profile.organizationId))
      if (!snap.exists()) { setOrg(null); return }
      const orgData = { id: snap.id, ...snap.data() }
      setOrg(orgData)

      // Restore saved branch if it belongs to this org
      const saved = getSavedBranch()
      if (saved && (orgData.branches ?? []).some(b => b.uid === saved.uid) && saved.uid !== profile.id) {
        setActiveBranchUid(saved.uid)
        setActiveBranchState(saved)
        const branchProfile = await loadFirebaseProfile(saved.uid)
        if (branchProfile) {
          const hasWriteAccess = (branchProfile.allowedWriters ?? []).includes(profile.id)
          setDoctor({
            ...branchProfile,
            _activeBranch:  saved,
            _baseDoctor:    base ?? profile,
            organizationId: profile.organizationId,
            viewOnly:       !hasWriteAccess,
          })
        }
      }
    } catch { setOrg(null) }
  }, [])

  // Clinic admin: load profiles for all doctors in managedDoctors array
  const loadManagedDoctors = useCallback(async (profile) => {
    if (profile?.clinicRole !== 'clinic_admin' || !profile.managedDoctors?.length) {
      setManagedDoctors([])
      return
    }
    try {
      const profiles = await Promise.all(profile.managedDoctors.map(uid => loadFirebaseProfile(uid)))
      setManagedDoctors(profiles.filter(Boolean))
    } catch {
      setManagedDoctors([])
    }
  }, [])

  // Clinic admin: re-fetch own profile + reload managed doctor profiles (call after adding a new doctor)
  const refreshManagedDoctors = useCallback(async () => {
    if (!baseDoctor?.id) return
    const updated = await loadFirebaseProfile(baseDoctor.id)
    if (!updated) return
    setBaseDoctor(updated)
    setDoctor(prev => (prev?._isManagedView ? prev : updated))
    await loadManagedDoctors(updated)
  }, [baseDoctor, loadManagedDoctors])

  // Clinic admin: switch to view a managed doctor's data (transparent — doctor doesn't know)
  const switchManagedDoctor = useCallback(async (uid) => {
    // Always clear org branch state — managed doctor view and branch view are mutually exclusive
    setActiveBranchState(null)
    saveActiveBranch(null)
    if (!uid) {
      setActiveBranchUid(null)
      setActiveManagedDoctor(null)
      setDoctor(baseDoctor)
      return
    }
    setActiveBranchUid(uid)
    const profile = await loadFirebaseProfile(uid)
    if (profile) {
      setActiveManagedDoctor(profile)
      setDoctor({ ...profile, _baseDoctorId: baseDoctor?.id, _isManagedView: true, viewOnly: false })
    }
  }, [baseDoctor])

  // Switch active branch — loads that branch's profile and redirects dataStore
  // Returns { ok: true } or { ok: false, reason: string }
  const switchBranch = useCallback(async (branch) => {
    if (!branch) {
      setActiveBranchUid(null)
      setActiveBranchState(null)
      setDoctor(baseDoctor)
      saveActiveBranch(null)
      return { ok: true }
    }
    const branchProfile = await loadFirebaseProfile(branch.uid)
    if (!branchProfile) return { ok: false, reason: 'Branch profile not found.' }

    const allowedReaders = branchProfile.allowedReaders   // null = backward-compat: anyone in org can read
    const allowedWriters = branchProfile.allowedWriters ?? []
    const myUid          = baseDoctor?.id

    // Read access: granted when allowedReaders is null (not yet configured) OR uid is in either list
    const hasReadAccess  = allowedReaders === null || allowedReaders.includes(myUid) || allowedWriters.includes(myUid)
    if (!hasReadAccess) return { ok: false, reason: 'This branch has not granted you read access.' }

    const hasWriteAccess = allowedWriters.includes(myUid)
    // Always clear managed doctor view — branch view and managed doctor view are mutually exclusive
    setActiveManagedDoctor(null)
    setActiveBranchUid(branch.uid)
    setActiveBranchState(branch)
    saveActiveBranch(branch)
    setDoctor({
      ...branchProfile,
      _activeBranch:  branch,
      _baseDoctor:    baseDoctor,
      organizationId: baseDoctor?.organizationId,
      viewOnly:       !hasWriteAccess,
    })
    return { ok: true }
  }, [baseDoctor])

  const logout = async () => {
    if (doctor?.backend === 'SB' && supabase) {
      await supabase.auth.signOut()
    } else {
      const { signOut } = await import('firebase/auth')
      await signOut(auth)
    }
    clearSessionLocally()
    clearDataStoreCache()
    saveActiveBranch(null)
    setActiveBranchUid(null)
    setActiveBranchState(null)
    setBaseDoctor(null)
    setOrg(null)
    setManagedDoctors([])
    setActiveManagedDoctor(null)
    setDoctor(null)
  }

  // Works for doctor and receptionist accounts alike — both are real
  // email/password users in whichever backend, so no role branching needed.
  const resetPassword = async (email, backend = 'FB') => {
    if (backend === 'SB') {
      if (!supabase) throw new Error('Supabase is not configured.')
      const { error } = await supabase.auth.resetPasswordForEmail(email)
      if (error) throw error
      return
    }
    const { sendPasswordResetEmail } = await import('firebase/auth')
    await sendPasswordResetEmail(auth, email)
  }

  const isReceptionist = doctor?._role === 'receptionist'

  return (
    <AuthContext.Provider value={{ doctor, loading, signup, signupReceptionist, login, logout, resetPassword, updateProfile, generateReceptionistCode, isReceptionist, org, activeBranch, switchBranch, baseDoctor, managedDoctors, activeManagedDoctor, switchManagedDoctor, refreshManagedDoctors }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
