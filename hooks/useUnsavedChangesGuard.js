'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useNavigationGuard } from '@/context/NavigationGuardContext'

// Confirms with the user before leaving a page with unsaved changes.
// Covers in-app navigation (via requestLeave/guardedBack), tab close/refresh
// (beforeunload), and the browser's own Back/Forward button or swipe-back
// gesture (popstate) — none of which Next.js's router intercepts on its own.
//
// How the Back-button guard works: while dirty, we push one extra "buffer"
// history entry pointing at the same URL. A real back press lands on that
// buffer entry (same URL, no route change) instead of leaving immediately,
// which fires popstate while we're still safely on this page. We re-arm the
// buffer and show the confirm modal; only on confirm do we jump back two
// entries (past the buffer) to actually leave.
export function useUnsavedChangesGuard(isDirty) {
  const router = useRouter()
  const { setGuard, clearGuard } = useNavigationGuard()
  const isDirtyRef = useRef(isDirty)
  isDirtyRef.current = isDirty

  const [pendingNav, setPendingNav] = useState(null)
  const bypassPopRef = useRef(false)
  const guardedRef   = useRef(false) // true once the buffer entry is sitting in history

  const requestLeave = useCallback((navigate) => {
    isDirtyRef.current ? setPendingNav(() => navigate) : navigate()
  }, [])

  // Register with the app-wide navigation guard so the sidebar, global
  // search, and logout also confirm before leaving this page — not just its
  // own Back/Cancel buttons.
  useEffect(() => {
    const guard = { isDirty: () => isDirtyRef.current, requestLeave }
    setGuard(guard)
    return () => clearGuard(guard)
  }, [setGuard, clearGuard, requestLeave])

  const confirmLeave = useCallback(() => {
    pendingNav?.()
    setPendingNav(null)
  }, [pendingNav])

  const cancelLeave = useCallback(() => setPendingNav(null), [])

  // Tab close / refresh
  useEffect(() => {
    const handler = (e) => {
      if (!isDirtyRef.current) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [])

  // Browser Back/Forward button + swipe-back gesture
  useEffect(() => {
    if (!isDirty) return
    window.history.pushState({ __unsavedGuard: true }, '', window.location.href)
    guardedRef.current = true

    const onPopState = () => {
      if (bypassPopRef.current) { bypassPopRef.current = false; guardedRef.current = false; return }
      if (!isDirtyRef.current) return
      window.history.pushState({ __unsavedGuard: true }, '', window.location.href)
      requestLeave(() => {
        bypassPopRef.current = true
        window.history.go(-2)
      })
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [isDirty, requestLeave])

  // Drop-in replacement for router.back() that accounts for the buffer entry
  const guardedBack = useCallback(() => {
    requestLeave(() => {
      if (guardedRef.current) {
        bypassPopRef.current = true
        window.history.go(-2)
      } else {
        router.back()
      }
    })
  }, [requestLeave, router])

  return { pendingNav, requestLeave, confirmLeave, cancelLeave, guardedBack }
}
