'use client'
import { useState, useEffect, useRef } from 'react'

/**
 * Autocomplete input for service/billing line descriptions.
 * Shows a dropdown of doctor.serviceCharges with name + price.
 * On selection the caller gets (name, price) so it can pre-fill unit price.
 * The price field on the invoice row stays editable — the suggested price is
 * just a starting value the doctor can override.
 */
export default function ServiceSuggest({ value, onChange, onSelect, services = [], readOnly, className, placeholder }) {
  const [open,  setOpen]  = useState(false)
  const [query, setQuery] = useState(value ?? '')
  const ref = useRef(null)

  // Sync when parent changes value (e.g. quick-add chip fills a new line)
  useEffect(() => { setQuery(value ?? '') }, [value])

  // Close dropdown on outside click
  useEffect(() => {
    const handler = e => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = services.filter(s =>
    !query.trim() || s.name.toLowerCase().includes(query.toLowerCase())
  )

  const handleChange = e => {
    const v = e.target.value
    setQuery(v)
    onChange(v)
    setOpen(true)
  }

  const handlePick = sc => {
    setQuery(sc.name)
    onSelect(sc.name, sc.price ?? 0)
    setOpen(false)
  }

  if (readOnly) return (
    <input value={value ?? ''} readOnly className={className} placeholder={placeholder}/>
  )

  return (
    <div ref={ref} className="relative">
      <input
        value={query}
        onChange={handleChange}
        onFocus={() => setOpen(true)}
        placeholder={placeholder ?? 'Service description'}
        className={className}
      />
      {open && services.length > 0 && (
        <ul className="absolute z-50 left-0 right-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-lg overflow-hidden max-h-56 overflow-y-auto">
          {filtered.length > 0 ? filtered.map(sc => (
            <li key={sc.id}>
              <button
                type="button"
                onMouseDown={() => handlePick(sc)}
                className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-sm hover:bg-blue-50 dark:hover:bg-blue-900/20 text-left transition-colors"
              >
                <span className="font-medium text-gray-800 dark:text-gray-200 flex-1 truncate">{sc.name}</span>
                {sc.price > 0 && (
                  <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 flex-shrink-0 tabular-nums">
                    ₹{Number(sc.price).toLocaleString('en-IN')}
                  </span>
                )}
              </button>
            </li>
          )) : (
            <li className="px-3 py-2.5 text-sm text-gray-400 dark:text-gray-500 italic">No matching services</li>
          )}
        </ul>
      )}
    </div>
  )
}
