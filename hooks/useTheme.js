'use client'
import { useState, useEffect, useCallback } from 'react'
import { applyTheme, DEFAULT_THEME } from '@/lib/themes'
import { dataStore } from '@/lib/dataStore'
import { auth, db } from '@/lib/firebase'

const LS_DARK_KEY  = 'theme'
const LS_COLOR_KEY = 'colorTheme'
const DB_META_KEY  = 'colorTheme'

async function saveThemeToProfile(key) {
  try {
    const uid = auth?.currentUser?.uid
    if (!uid || !db) return
    const { doc, updateDoc } = await import('firebase/firestore')
    await updateDoc(doc(db, 'users', uid), { colorTheme: key, darkMode: undefined })
  } catch {}
}

async function saveDarkToProfile(isDark) {
  try {
    const uid = auth?.currentUser?.uid
    if (!uid || !db) return
    const { doc, updateDoc } = await import('firebase/firestore')
    await updateDoc(doc(db, 'users', uid), { darkMode: isDark })
  } catch {}
}

export function useTheme() {
  const [dark,       setDark]       = useState(false)
  const [colorTheme, setColorTheme] = useState(DEFAULT_THEME)

  // ── On mount: restore both dark mode and color theme ──────────────────────
  useEffect(() => {
    // Dark mode
    const saved       = localStorage.getItem(LS_DARK_KEY)
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const isDark      = saved ? saved === 'dark' : prefersDark
    setDark(isDark)
    document.documentElement.classList.toggle('dark', isDark)

    // Color theme — apply localStorage immediately, then hydrate from Firestore
    const lsColor = localStorage.getItem(LS_COLOR_KEY) ?? DEFAULT_THEME
    setColorTheme(lsColor)
    applyTheme(lsColor)

    // Firestore sync — check both meta and doctor profile for cross-device preference
    Promise.allSettled([
      dataStore.getMeta(DB_META_KEY),
      (async () => {
        const { auth: fbAuth, db: fbDb } = await import('@/lib/firebase')
        const uid = fbAuth?.currentUser?.uid
        if (!uid || !fbDb) return null
        const { doc, getDoc } = await import('firebase/firestore')
        const snap = await getDoc(doc(fbDb, 'users', uid))
        return snap.exists() ? snap.data().colorTheme : null
      })(),
    ]).then(([metaResult, profileResult]) => {
      const dbColor = metaResult.value || profileResult.value || null
      if (dbColor && dbColor !== lsColor) {
        setColorTheme(dbColor)
        applyTheme(dbColor)
        localStorage.setItem(LS_COLOR_KEY, dbColor)
      }
    }).catch(() => {})
  }, [])

  // ── Dark mode toggle — saves to localStorage + doctor profile ─────────────
  const toggle = useCallback(() => {
    setDark(prev => {
      const next = !prev
      document.documentElement.classList.toggle('dark', next)
      localStorage.setItem(LS_DARK_KEY, next ? 'dark' : 'light')
      saveDarkToProfile(next)
      return next
    })
  }, [])

  // ── Color theme — applies CSS vars, saves to localStorage + meta + profile ─
  const setTheme = useCallback((key) => {
    setColorTheme(key)
    applyTheme(key)
    localStorage.setItem(LS_COLOR_KEY, key)
    dataStore.setMeta(DB_META_KEY, key).catch(() => {})
    saveThemeToProfile(key)
  }, [])

  return { dark, toggle, colorTheme, setTheme }
}
