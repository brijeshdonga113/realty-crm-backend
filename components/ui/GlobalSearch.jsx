'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { dataStore } from '@/lib/dataStore'
import { useAuth } from '@/context/AuthContext'
import { useNavigationGuard } from '@/context/NavigationGuardContext'

export function GlobalSearch() {
  const router = useRouter()
  const { doctor } = useAuth()
  const { guardedNavigate } = useNavigationGuard()
  const [open, setOpen]           = useState(false)
  const [query, setQuery]         = useState('')
  const [patients, setPatients]   = useState([])
  const [inventory, setInventory] = useState([])
  const [loading, setLoading]     = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef  = useRef(null)

  const openSearch = useCallback(() => {
    setOpen(true)
    setQuery('')
    setActiveIdx(0)
  }, [])

  const closeSearch = useCallback(() => {
    setOpen(false)
    setQuery('')
  }, [])

  // Subscribe to live data while the modal is open
  useEffect(() => {
    if (!open || !doctor) return
    setLoading(true)
    let pReady = false
    let iReady = false
    const markReady = () => { if (pReady && iReady) setLoading(false) }

    const unsubP = dataStore.subscribe('patients', (data) => {
      setPatients(data)
      pReady = true
      markReady()
    })
    const unsubI = dataStore.subscribe('inventory', (data) => {
      setInventory(data)
      iReady = true
      markReady()
    })
    return () => { unsubP(); unsubI() }
  }, [open, doctor])

  // ⌘K / Ctrl+K global shortcut
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(o => { if (!o) { setQuery(''); setActiveIdx(0) } return !o })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Focus input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30)
  }, [open])

  // Reset active index when query changes
  useEffect(() => { setActiveIdx(0) }, [query])

  const q = query.toLowerCase().trim()

  const qDigits = q.replace(/\D/g, '')

  const matchedPatients = patients.filter(p => {
    if (!q) return false
    const fullName = `${p.firstName || ''} ${p.lastName || ''}`.toLowerCase()
    if (fullName.includes(q)) return true
    if (p.email && p.email.toLowerCase().includes(q)) return true
    if (qDigits && p.phone && p.phone.replace(/\D/g, '').includes(qDigits)) return true
    if (p.patientNumber && String(p.patientNumber).includes(q)) return true
    return false
  }).slice(0, 6)

  const matchedInventory = inventory.filter(i =>
    !q
      ? false
      : (i.name && i.name.toLowerCase().includes(q)) ||
        (i.potency && i.potency.toLowerCase().includes(q)) ||
        (i.dosageForm && i.dosageForm.toLowerCase().includes(q)) ||
        (i.category && i.category.toLowerCase().includes(q))
  ).slice(0, 5)

  // Flat list for keyboard nav
  const allResults = [
    ...matchedPatients.map(p  => ({ type: 'patient',   item: p })),
    ...matchedInventory.map(i => ({ type: 'inventory', item: i })),
  ]

  const navigate = (href) => {
    const go = () => { closeSearch(); router.push(href) }
    if (guardedNavigate(null, go)) go()
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') { closeSearch(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, allResults.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)) }
    if (e.key === 'Enter' && allResults[activeIdx]) {
      const r = allResults[activeIdx]
      navigate(r.type === 'patient' ? `/patients/${r.item.id}` : '/inventory')
    }
  }

  const stockBadge = (item) => {
    const qty = item.quantity ?? 0
    const low = item.lowStockThreshold ?? 10
    if (qty === 0)   return { label: 'Out',  cls: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' }
    if (qty <= low)  return { label: String(qty), cls: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' }
    return              { label: String(qty), cls: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' }
  }

  return (
    <>
      {/* ── Trigger button ─────────────────────────────────────────────────── */}
      <button onClick={openSearch}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-gray-400 dark:text-gray-500 hover:border-gray-300 dark:hover:border-gray-500 hover:bg-white dark:hover:bg-gray-700 transition-all flex-shrink-0"
        title="Search (⌘K)">
        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
        </svg>
        <span className="hidden md:block text-xs whitespace-nowrap">Search…</span>
        <kbd className="hidden md:inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-800">
          ⌘K
        </kbd>
      </button>

      {/* ── Modal ──────────────────────────────────────────────────────────── */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4"
          onMouseDown={closeSearch}>
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm pointer-events-none"/>

          {/* Panel */}
          <div className="relative w-full max-w-xl bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
            onMouseDown={e => e.stopPropagation()}>

            {/* Search input row */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100 dark:border-gray-700">
              <svg className="w-5 h-5 text-gray-400 dark:text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search by name, phone, email, medicine…"
                className="flex-1 bg-transparent text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 text-base outline-none"
              />
              {query && (
                <button onClick={() => { setQuery(''); inputRef.current?.focus() }}
                  className="text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              )}
              <kbd className="hidden sm:inline-flex px-2 py-1 text-xs font-medium text-gray-400 dark:text-gray-500 border border-gray-200 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700">
                Esc
              </kbd>
            </div>

            {/* Results area */}
            <div className="max-h-[28rem] overflow-y-auto overscroll-contain">
              {loading && (
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-400 dark:text-gray-500">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Loading…
                </div>
              )}

              {!loading && !q && (
                <div className="py-10 text-center text-sm text-gray-400 dark:text-gray-500">
                  <svg className="w-8 h-8 mx-auto mb-3 text-gray-200 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                  </svg>
                  Type to search patients and medicines
                </div>
              )}

              {!loading && q && !matchedPatients.length && !matchedInventory.length && (
                <div className="py-10 text-center">
                  <p className="text-sm text-gray-400 dark:text-gray-500">
                    No results for <span className="font-semibold text-gray-600 dark:text-gray-300">"{query}"</span>
                  </p>
                </div>
              )}

              {/* Patients */}
              {matchedPatients.length > 0 && (
                <div>
                  <p className="px-4 pt-3 pb-1.5 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider flex items-center gap-2">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
                    </svg>
                    Patients
                  </p>
                  {matchedPatients.map((p, idx) => {
                    const gIdx    = idx
                    const isActive = activeIdx === gIdx
                    const initials = `${p.firstName?.[0] ?? ''}${p.lastName?.[0] ?? ''}`.toUpperCase()
                    return (
                      <button key={p.id}
                        onClick={() => navigate(`/patients/${p.id}`)}
                        onMouseMove={() => setActiveIdx(gIdx)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                          isActive
                            ? 'bg-primary-50 dark:bg-primary-900/20'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                        }`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                          isActive
                            ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                        }`}>
                          {initials || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                            {p.firstName} {p.lastName}
                          </p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                            {[p.phone, p.patientNumber ? `#${p.patientNumber}` : null, p.gender].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                        {p.status && p.status !== 'active' && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 capitalize flex-shrink-0">
                            {p.status}
                          </span>
                        )}
                        <svg className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                        </svg>
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Medicines */}
              {matchedInventory.length > 0 && (
                <div>
                  <p className="px-4 pt-3 pb-1.5 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider flex items-center gap-2">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"/>
                    </svg>
                    Medicines
                  </p>
                  {matchedInventory.map((item, idx) => {
                    const gIdx     = matchedPatients.length + idx
                    const isActive = activeIdx === gIdx
                    const badge    = stockBadge(item)
                    return (
                      <button key={item.id}
                        onClick={() => navigate('/inventory')}
                        onMouseMove={() => setActiveIdx(gIdx)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                          isActive
                            ? 'bg-teal-50 dark:bg-teal-900/20'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                        }`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                          isActive
                            ? 'bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300'
                            : 'bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400'
                        }`}>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"/>
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                            {item.name}{item.potency ? ` (${item.potency})` : ''}
                          </p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                            {[item.dosageForm, item.category].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Spacer at bottom */}
              {(matchedPatients.length > 0 || matchedInventory.length > 0) && <div className="h-2"/>}
            </div>

            {/* Footer hint */}
            <div className="px-4 py-2.5 border-t border-gray-100 dark:border-gray-700 flex items-center gap-4 text-[11px] text-gray-400 dark:text-gray-500">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[10px] font-medium">↑↓</kbd> navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[10px] font-medium">↵</kbd> open
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[10px] font-medium">Esc</kbd> close
              </span>
              {q && allResults.length > 0 && (
                <span className="ml-auto">
                  <span className="font-semibold text-gray-600 dark:text-gray-300">{allResults.length}</span> result{allResults.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
