'use client'
import { createContext, useContext, useRef, useCallback } from 'react'

const NavigationGuardContext = createContext(null)

// Lets any page (via useUnsavedChangesGuard) register itself as "dirty" so
// that global navigation surfaces outside that page's own UI — the sidebar,
// global search, logout — also confirm before leaving instead of silently
// discarding unsaved work. Only one page can hold the guard at a time, which
// matches reality: only the currently-mounted page can be dirty.
export function NavigationGuardProvider({ children }) {
  const guardRef = useRef(null) // { isDirty: () => boolean, requestLeave: (navigate) => void }

  const setGuard   = useCallback((guard) => { guardRef.current = guard }, [])
  const clearGuard = useCallback((guard) => { if (guardRef.current === guard) guardRef.current = null }, [])

  // Call from a click handler. Returns true if the caller should proceed with
  // navigation itself (nothing was dirty); returns false if it was
  // intercepted — in that case `e` (if given) is preventDefault()ed and the
  // confirm-leave flow already registered by the page takes over.
  const guardedNavigate = useCallback((e, navigate) => {
    const guard = guardRef.current
    if (guard && guard.isDirty()) {
      e?.preventDefault?.()
      guard.requestLeave(navigate)
      return false
    }
    return true
  }, [])

  return (
    <NavigationGuardContext.Provider value={{ setGuard, clearGuard, guardedNavigate }}>
      {children}
    </NavigationGuardContext.Provider>
  )
}

export function useNavigationGuard() {
  const ctx = useContext(NavigationGuardContext)
  if (!ctx) throw new Error('useNavigationGuard must be used inside NavigationGuardProvider')
  return ctx
}
