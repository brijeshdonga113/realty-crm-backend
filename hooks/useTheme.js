'use client'
import { useState, useEffect, useCallback } from 'react'
import { applyTheme, DEFAULT_THEME } from '@/lib/themes'
import { dataStore } from '@/lib/dataStore'

const LS_DARK_KEY  = 'theme'
const LS_COLOR_KEY = 'colorTheme'
const DB_COLOR_KEY = 'colorTheme'

export function useTheme() {
  const [dark,       setDark]       = useState(false)
  const [colorTheme, setColorTheme] = useState(DEFAULT_THEME)

  // ── On mount: restore both dark mode and color theme ──────────────────────
  useEffect(() => {
    // Dark mode
    const saved      = localStorage.getItem(LS_DARK_KEY)
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const isDark      = saved ? saved === 'dark' : prefersDark
    setDark(isDark)
    document.documentElement.classList.toggle('dark', isDark)

    // Color theme — try localStorage first for instant paint, then Firestore
    const lsColor = localStorage.getItem(LS_COLOR_KEY) ?? DEFAULT_THEME
    setColorTheme(lsColor)
    applyTheme(lsColor)

    // Hydrate from Firestore (may override localStorage if synced from another device)
    dataStore.getMeta(DB_COLOR_KEY).then(dbColor => {
      if (dbColor && dbColor !== lsColor) {
        setColorTheme(dbColor)
        applyTheme(dbColor)
        localStorage.setItem(LS_COLOR_KEY, dbColor)
      }
    }).catch(() => {})
  }, [])

  // ── Dark mode toggle ───────────────────────────────────────────────────────
  const toggle = useCallback(() => {
    setDark(prev => {
      const next = !prev
      document.documentElement.classList.toggle('dark', next)
      localStorage.setItem(LS_DARK_KEY, next ? 'dark' : 'light')
      return next
    })
  }, [])

  // ── Color theme setter — applies CSS vars, saves to localStorage + Firestore
  const setTheme = useCallback((key) => {
    setColorTheme(key)
    applyTheme(key)
    localStorage.setItem(LS_COLOR_KEY, key)
    dataStore.setMeta(DB_COLOR_KEY, key).catch(() => {})
  }, [])

  return { dark, toggle, colorTheme, setTheme }
}
