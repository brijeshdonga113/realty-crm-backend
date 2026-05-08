'use client'
import { useState, useEffect, useCallback } from 'react'
import { applyTheme, DEFAULT_THEME } from '@/lib/themes'
import { auth, db } from '@/lib/firebase'

// Return the Firebase UID of the currently logged-in user (receptionist or doctor).
// Also return their role so we know which Firestore path to write to.
function getSessionMeta() {
  try {
    const session = JSON.parse(localStorage.getItem('clinic_crm_doctor') ?? 'null')
    if (!session) return { uid: null, role: 'doctor' }
    const uid  = session._role === 'receptionist' ? session._receptionistUid : session.id
    const role = session._role === 'receptionist' ? 'receptionist' : 'doctor'
    return { uid, role }
  } catch {
    return { uid: null, role: 'doctor' }
  }
}

// localStorage keys scoped per user so doctor and receptionist don't share settings
// on the same browser.
function lsKeys(uid) {
  const suffix = uid ? `_${uid}` : ''
  return { darkKey: `theme${suffix}`, colorKey: `colorTheme${suffix}` }
}

async function saveThemeToFirestore(colorKey) {
  try {
    const uid = auth?.currentUser?.uid
    if (!uid || !db) return
    const { uid: sessionUid, role } = getSessionMeta()
    const { doc, updateDoc, setDoc } = await import('firebase/firestore')
    if (role === 'receptionist' && sessionUid) {
      await setDoc(doc(db, 'receptionists', sessionUid), { colorTheme: colorKey }, { merge: true })
    } else {
      await updateDoc(doc(db, 'users', uid, 'profile', 'doctor'), { colorTheme: colorKey })
    }
  } catch {}
}

async function saveDarkToFirestore(isDark) {
  try {
    const uid = auth?.currentUser?.uid
    if (!uid || !db) return
    const { uid: sessionUid, role } = getSessionMeta()
    const { doc, updateDoc, setDoc } = await import('firebase/firestore')
    if (role === 'receptionist' && sessionUid) {
      await setDoc(doc(db, 'receptionists', sessionUid), { darkMode: isDark }, { merge: true })
    } else {
      await updateDoc(doc(db, 'users', uid, 'profile', 'doctor'), { darkMode: isDark })
    }
  } catch {}
}

async function loadColorFromFirestore(uid, role) {
  try {
    if (!uid || !db) return null
    const { doc, getDoc } = await import('firebase/firestore')
    if (role === 'receptionist') {
      const snap = await getDoc(doc(db, 'receptionists', uid))
      return snap.exists() ? (snap.data().colorTheme ?? null) : null
    } else {
      const snap = await getDoc(doc(db, 'users', uid, 'profile', 'doctor'))
      return snap.exists() ? (snap.data().colorTheme ?? null) : null
    }
  } catch {
    return null
  }
}

export function useTheme() {
  const [dark,       setDark]       = useState(false)
  const [colorTheme, setColorTheme] = useState(DEFAULT_THEME)

  useEffect(() => {
    const { uid, role } = getSessionMeta()
    const { darkKey, colorKey } = lsKeys(uid)

    // Dark mode
    const saved       = localStorage.getItem(darkKey)
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const isDark      = saved ? saved === 'dark' : prefersDark
    setDark(isDark)
    document.documentElement.classList.toggle('dark', isDark)
    // Keep universal key in sync so the inline flash-prevention script can read it
    localStorage.setItem('darkMode', isDark ? 'dark' : 'light')

    // Color theme — apply localStorage immediately, then hydrate from Firestore
    const lsColor = localStorage.getItem(colorKey) ?? DEFAULT_THEME
    setColorTheme(lsColor)
    applyTheme(lsColor)

    loadColorFromFirestore(uid, role).then(dbColor => {
      if (dbColor && dbColor !== lsColor) {
        setColorTheme(dbColor)
        applyTheme(dbColor)
        localStorage.setItem(colorKey, dbColor)
      }
    }).catch(() => {})
  }, [])

  const toggle = useCallback(() => {
    const { uid } = getSessionMeta()
    const { darkKey } = lsKeys(uid)
    setDark(prev => {
      const next = !prev
      document.documentElement.classList.toggle('dark', next)
      localStorage.setItem(darkKey, next ? 'dark' : 'light')
      localStorage.setItem('darkMode', next ? 'dark' : 'light')
      saveDarkToFirestore(next)
      return next
    })
  }, [])

  const setTheme = useCallback((key) => {
    const { uid } = getSessionMeta()
    const { colorKey } = lsKeys(uid)
    setColorTheme(key)
    applyTheme(key)
    localStorage.setItem(colorKey, key)
    // Also update the unscoped key so the inline flash-prevention script
    // (getThemeScript in lib/themes.js) picks up the last active theme on next load.
    localStorage.setItem('colorTheme', key)
    saveThemeToFirestore(key)
  }, [])

  return { dark, toggle, colorTheme, setTheme }
}
