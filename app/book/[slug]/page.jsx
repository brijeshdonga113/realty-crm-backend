'use client'

import { useState, useEffect, useMemo } from 'react'
import { formatTime, toDateStr } from '@/lib/booking'

const DAYS_SHORT = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const DAYS_FULL  = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS     = ['January','February','March','April','May','June','July','August','September','October','November','December']

function addDays(date, n) {
  const d = new Date(date); d.setDate(d.getDate() + n); return d
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function Spinner({ size = 5 }) {
  return (
    <svg className={`animate-spin w-${size} h-${size}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
    </svg>
  )
}

function groupByPeriod(slots) {
  const morning = [], afternoon = [], evening = []
  slots.forEach(s => {
    const h = parseInt(s.time.split(':')[0], 10)
    if (h < 12) morning.push(s)
    else if (h < 17) afternoon.push(s)
    else evening.push(s)
  })
  return [
    { label: 'Morning',   icon: '🌤', slots: morning },
    { label: 'Afternoon', icon: '☀️', slots: afternoon },
    { label: 'Evening',   icon: '🌙', slots: evening },
  ].filter(g => g.slots.length > 0)
}

// ── Screens ───────────────────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="flex flex-col items-center gap-4 text-gray-400">
        <div className="w-14 h-14 bg-white rounded-2xl shadow-md flex items-center justify-center">
          <Spinner size={6} />
        </div>
        <p className="text-sm font-medium">Loading booking page…</p>
      </div>
    </div>
  )
}

function ErrorScreen({ status }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 max-w-sm w-full text-center">
        <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M12 3a9 9 0 100 18A9 9 0 0012 3z"/>
          </svg>
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-2">
          {status >= 500 ? 'Service unavailable' : 'Booking link not found'}
        </h2>
        <p className="text-sm text-gray-500 leading-relaxed">
          {status >= 500
            ? 'The booking service is temporarily unavailable. Please contact the clinic directly.'
            : 'This booking link is invalid or has been removed. Please ask the clinic for an updated link.'}
        </p>
      </div>
    </div>
  )
}

function ConfirmedScreen({ doctor, selectedDate, selectedTime, patientName }) {
  const dateLabel = `${DAYS_FULL[selectedDate.getDay()]}, ${selectedDate.getDate()} ${MONTHS[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-lg border border-gray-100 max-w-md w-full overflow-hidden">
        {/* Top gradient band */}
        <div className="bg-gradient-to-br from-green-500 to-emerald-600 px-8 pt-8 pb-10 text-center relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
          </div>
          <div className="relative">
            <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-1">You're booked!</h2>
            <p className="text-green-100 text-sm">Your appointment is confirmed</p>
          </div>
        </div>

        {/* Details card */}
        <div className="px-6 py-6">
          {/* Clinic info */}
          {(doctor.clinicName || doctor.name) && (
            <div className="flex items-center gap-3 mb-5 pb-5 border-b border-gray-100">
              {doctor.logoUrl ? (
                <div className="w-11 h-11 rounded-xl border border-gray-100 shadow-sm overflow-hidden flex-shrink-0 flex items-center justify-center bg-white p-1">
                  <img src={doctor.logoUrl} alt="" className="w-full h-full object-contain" />
                </div>
              ) : (
                <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5"/>
                  </svg>
                </div>
              )}
              <div>
                <p className="text-sm font-bold text-gray-900">{doctor.clinicName || `Dr. ${doctor.name}`}</p>
                {doctor.clinicName && doctor.name && <p className="text-xs text-gray-400">Dr. {doctor.name}</p>}
              </div>
            </div>
          )}

          {/* Appointment details */}
          <div className="space-y-3">
            {[
              { icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', label: 'Date', value: dateLabel },
              { icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', label: 'Time', value: formatTime(selectedTime) },
              { icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z', label: 'Patient', value: patientName },
            ].map(({ icon, label, value }) => (
              <div key={label} className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3">
                <div className="w-8 h-8 bg-white rounded-lg shadow-sm flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={icon}/>
                  </svg>
                </div>
                <div>
                  <p className="text-xs text-gray-400">{label}</p>
                  <p className="text-sm font-semibold text-gray-900">{value}</p>
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs text-gray-400 text-center mt-5 leading-relaxed">
            Please arrive 5 minutes early. Contact the clinic if you need to cancel or reschedule.
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Hero with step indicator ───────────────────────────────────────────────────

function BookingHero({ doctor, step }) {
  const initials = doctor.name
    ? doctor.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '?'

  const steps = [
    { n: 1, label: 'Choose Date' },
    { n: 2, label: 'Pick a Time' },
    { n: 3, label: 'Your Details' },
  ]

  return (
    <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 relative overflow-hidden">
      {/* Decorative blobs */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-16 -right-16 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-white/5 rounded-full blur-3xl" />
      </div>

      <div className="max-w-5xl mx-auto px-4 pt-8 pb-0 relative">
        {/* Doctor / clinic info */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 pb-8">
          {/* Logo or initials avatar */}
          {doctor.logoUrl ? (
            <div className="w-20 h-20 rounded-2xl bg-white shadow-xl flex items-center justify-center p-2 overflow-hidden flex-shrink-0">
              <img
                src={doctor.logoUrl}
                alt={doctor.clinicName || 'Clinic'}
                className="w-full h-full object-contain"
                onError={e => { e.currentTarget.style.display = 'none' }}
              />
            </div>
          ) : (
            <div className="w-20 h-20 rounded-2xl bg-white/15 backdrop-blur border border-white/20 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-2xl font-bold">{initials}</span>
            </div>
          )}

          {/* Text info */}
          <div className="flex-1 min-w-0">
            <p className="text-blue-200 text-xs font-semibold uppercase tracking-widest mb-1.5">
              Online Appointment Booking
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold text-white truncate">
              {doctor.clinicName || `Dr. ${doctor.name}`}
            </h1>
            {doctor.clinicName && doctor.name && (
              <p className="text-blue-200 text-sm mt-0.5">Dr. {doctor.name}</p>
            )}
            {doctor.specialization && (
              <span className="inline-flex items-center gap-1.5 mt-2.5 text-xs font-semibold bg-white/15 text-white px-3 py-1.5 rounded-full capitalize">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
                </svg>
                {doctor.specialization.replace(/_/g, ' ')}
              </span>
            )}
          </div>

          {/* Verified badge */}
          <div className="hidden sm:flex items-center gap-3 bg-white/10 backdrop-blur border border-white/10 rounded-2xl px-5 py-3 flex-shrink-0">
            <div className="w-8 h-8 bg-green-400/20 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
              </svg>
            </div>
            <div>
              <p className="text-white text-xs font-bold">Verified Clinic</p>
              <p className="text-blue-200 text-xs">Secure instant booking</p>
            </div>
          </div>
        </div>

        {/* Step indicator strip */}
        <div className="border-t border-white/10 py-4">
          <div className="flex items-center gap-2">
            {steps.map((s, i) => {
              const done   = step > s.n
              const active = step === s.n
              return (
                <div key={s.n} className="flex items-center gap-2 flex-1 min-w-0">
                  <div className={`flex items-center gap-2 ${active ? 'opacity-100' : done ? 'opacity-90' : 'opacity-40'}`}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all
                      ${done ? 'bg-green-400 text-white' : active ? 'bg-white text-blue-700' : 'bg-white/20 text-white'}`}>
                      {done
                        ? <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>
                        : s.n}
                    </div>
                    <span className={`text-xs font-semibold hidden sm:block whitespace-nowrap ${active ? 'text-white' : 'text-blue-200'}`}>
                      {s.label}
                    </span>
                  </div>
                  {i < steps.length - 1 && (
                    <div className={`flex-1 h-px mx-1 ${done ? 'bg-green-400/40' : 'bg-white/15'}`} />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Date picker — full month calendar ─────────────────────────────────────────

function DatePicker({ today, workingHours, selectedDate, onSelect }) {
  const [viewYear,  setViewYear]  = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())

  const workDays = workingHours?.workDays ?? [1, 2, 3, 4, 5]

  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth     = new Date(viewYear, viewMonth + 1, 0).getDate()
  const canGoPrev       = viewYear > today.getFullYear() || viewMonth > today.getMonth()

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  const cells = [
    ...Array(firstDayOfMonth).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(viewYear, viewMonth, i + 1)),
  ]

  const isAvailable = (date) => date >= today && workDays.includes(date.getDay())

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Month nav */}
      <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
        <button
          onClick={prevMonth}
          disabled={!canGoPrev}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
          </svg>
        </button>
        <span className="text-sm font-bold text-gray-900">{MONTHS[viewMonth]} {viewYear}</span>
        <button
          onClick={nextMonth}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
        >
          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
          </svg>
        </button>
      </div>

      <div className="p-4">
        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 mb-1">
          {DAYS_SHORT.map(d => (
            <div key={d} className="text-center text-xs font-bold text-gray-400 py-1.5">{d}</div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-0.5">
          {cells.map((date, i) => {
            if (!date) return <div key={`e-${i}`} />
            const available = isAvailable(date)
            const selected  = selectedDate && toDateStr(date) === toDateStr(selectedDate)
            const isToday   = toDateStr(date) === toDateStr(today)
            return (
              <button
                key={toDateStr(date)}
                onClick={() => available && onSelect(date)}
                disabled={!available}
                title={available ? `${DAYS_FULL[date.getDay()]}, ${date.getDate()} ${MONTHS[date.getMonth()]}` : undefined}
                className={`
                  aspect-square flex items-center justify-center rounded-xl text-sm font-medium transition-all
                  ${selected
                    ? 'bg-blue-600 text-white shadow-md scale-105'
                    : isToday && available
                      ? 'ring-2 ring-blue-400 ring-offset-1 text-blue-600 font-bold hover:bg-blue-50'
                      : available
                        ? 'text-gray-800 hover:bg-blue-50 hover:text-blue-600'
                        : 'text-gray-300 cursor-not-allowed'
                  }
                `}
              >
                {date.getDate()}
              </button>
            )
          })}
        </div>

        {/* Hours legend */}
        {workingHours && (
          <div className="mt-4 pt-3 border-t border-gray-50 flex items-center gap-1.5 flex-wrap">
            <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <span className="text-xs text-gray-400">
              {workDays.map(d => DAYS_SHORT[d]).join(' · ')} &nbsp;·&nbsp; {formatTime(workingHours.start)} – {formatTime(workingHours.end)}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Time slot grid ─────────────────────────────────────────────────────────────

function TimeSlotGrid({ selectedDate, slots, loading, onSelect, blockedReasons = [] }) {
  const dateLabel = `${DAYS_FULL[selectedDate.getDay()]}, ${selectedDate.getDate()} ${MONTHS[selectedDate.getMonth()]}`

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-50">
        <h2 className="font-bold text-gray-900">Available Times</h2>
        <p className="text-xs text-gray-400 mt-0.5">{dateLabel}</p>
      </div>
      <div className="p-5">
        {blockedReasons.length > 0 && (
          <div className="mb-4 flex gap-3 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
            <svg className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3a9 9 0 100 18A9 9 0 0012 3z"/>
            </svg>
            <div>
              <p className="text-xs font-semibold text-amber-700">Limited availability</p>
              {blockedReasons.map((r, i) => <p key={i} className="text-xs text-amber-600 mt-0.5">{r}</p>)}
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12 text-gray-400 gap-2">
            <Spinner size={5} /><span className="text-sm">Loading slots…</span>
          </div>
        ) : slots.length === 0 ? (
          <div className="py-12 text-center">
            <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-500">No slots available</p>
            <p className="text-xs text-gray-400 mt-1">Please select a different date</p>
          </div>
        ) : (
          <div className="space-y-5">
            {groupByPeriod(slots).map(({ label, icon, slots: group }) => (
              <div key={label}>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2.5">
                  {icon} {label}
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {group.map(({ time, available }) => (
                    <button
                      key={time}
                      disabled={!available}
                      onClick={() => available && onSelect(time)}
                      className={`py-2.5 rounded-xl text-sm font-semibold transition-all border
                        ${!available
                          ? 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed line-through'
                          : 'bg-white text-gray-700 border-gray-200 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 hover:shadow-sm'
                        }`}
                    >
                      {formatTime(time)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Booking form ───────────────────────────────────────────────────────────────

function BookingForm({ selectedDate, selectedTime, onSubmit, onChangeTime, submitting, error }) {
  const [form, setForm] = useState({ name: '', phone: '', reason: '' })
  const update = field => e => setForm(f => ({ ...f, [field]: e.target.value }))
  const dateLabel = `${DAYS_FULL[selectedDate.getDay()]}, ${selectedDate.getDate()} ${MONTHS[selectedDate.getMonth()]}`

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Selected slot summary */}
      <div className="bg-blue-600 px-5 py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-blue-100 text-xs font-semibold uppercase tracking-wider mb-0.5">Selected slot</p>
            <p className="text-white font-bold text-lg">{formatTime(selectedTime)}</p>
            <p className="text-blue-200 text-xs">{dateLabel}</p>
          </div>
          <button
            onClick={onChangeTime}
            className="flex items-center gap-1.5 text-xs font-semibold text-blue-200 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-2 rounded-lg transition-all"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
            </svg>
            Change
          </button>
        </div>
      </div>

      <form onSubmit={e => { e.preventDefault(); onSubmit(form) }} className="p-5 space-y-4">
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
            Full Name <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
            </svg>
            <input
              type="text" required value={form.name} onChange={update('name')}
              placeholder="Enter your full name"
              className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
            Phone Number <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
            </svg>
            <input
              type="tel" required value={form.phone} onChange={update('phone')}
              placeholder="e.g. 9876543210"
              className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
            Reason for Visit <span className="text-gray-400 font-normal normal-case">(optional)</span>
          </label>
          <textarea
            value={form.reason} onChange={update('reason')}
            placeholder="Briefly describe your concern…"
            rows={3}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all resize-none"
          />
        </div>

        {error && (
          <div className="flex items-start gap-2.5 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
            <svg className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
            </svg>
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || !form.name.trim() || !form.phone.trim()}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm hover:shadow-md"
        >
          {submitting ? <><Spinner size={4} /> Confirming…</> : (
            <>
              Confirm Appointment
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
              </svg>
            </>
          )}
        </button>

        <p className="text-center text-xs text-gray-400">
          By confirming, you agree to be contacted by the clinic regarding your appointment.
        </p>
      </form>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BookingPage({ params }) {
  const { slug } = params

  const today = useMemo(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d
  }, [])

  const [pageState,   setPageState]   = useState('loading')
  const [errorStatus, setErrorStatus] = useState(0)
  const [doctor,      setDoctor]      = useState(null)
  const [workingHours, setWorkingHours] = useState(null)

  const [selectedDate,    setSelectedDate]    = useState(null)
  const [slots,           setSlots]           = useState([])
  const [blockedReasons,  setBlockedReasons]  = useState([])
  const [loadingSlots,    setLoadingSlots]    = useState(false)
  const [selectedTime,    setSelectedTime]    = useState(null)

  const [submitError,   setSubmitError]   = useState('')
  const [submitting,    setSubmitting]    = useState(false)
  const [confirmedName, setConfirmedName] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    fetch(`/api/booking/${slug}`, { signal: controller.signal })
      .then(res => {
        if (!res.ok) { const e = new Error(); e.status = res.status; throw e }
        return res.json()
      })
      .then(data => {
        setDoctor(data.doctor)
        setWorkingHours(data.workingHours)
        setPageState('booking')
        if (data.doctor?.logoUrl) {
          let link = document.querySelector("link[rel~='icon']")
          if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link) }
          link.href = data.doctor.logoUrl
        }
      })
      .catch(err => {
        if (err.name !== 'AbortError') { setErrorStatus(err.status ?? 500); setPageState('error') }
      })
    return () => controller.abort()
  }, [slug])

  const handleDateSelect = async (date) => {
    setSelectedDate(date)
    setSelectedTime(null)
    setSlots([])
    setBlockedReasons([])
    setLoadingSlots(true)
    try {
      const res  = await fetch(`/api/booking/${slug}?date=${toDateStr(date)}`)
      const data = await res.json()
      setSlots(data.slots ?? [])
      setBlockedReasons(data.blockedReasons ?? [])
    } catch {
      setSlots([]); setBlockedReasons([])
    } finally {
      setLoadingSlots(false)
    }
  }

  const handleSubmit = async (form) => {
    setSubmitting(true); setSubmitError('')
    try {
      const res = await fetch(`/api/booking/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: toDateStr(selectedDate), time: selectedTime,
          name: form.name.trim(), phone: form.phone.trim(), reason: form.reason.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Booking failed')
      setConfirmedName(form.name.trim())
      setPageState('confirmed')
    } catch (err) {
      if (err.name !== 'AbortError') setSubmitError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (pageState === 'loading')   return <LoadingScreen />
  if (pageState === 'error')     return <ErrorScreen status={errorStatus} />
  if (pageState === 'confirmed') return (
    <ConfirmedScreen doctor={doctor} selectedDate={selectedDate} selectedTime={selectedTime} patientName={confirmedName} />
  )

  const step = !selectedDate ? 1 : !selectedTime ? 2 : 3

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-indigo-50/30">
      <BookingHero doctor={doctor} step={step} />

      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Left: calendar */}
          <DatePicker
            today={today}
            workingHours={workingHours}
            selectedDate={selectedDate}
            onSelect={handleDateSelect}
          />

          {/* Right: placeholder → slots → form */}
          <div>
            {!selectedDate ? (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center py-16 px-6 text-center h-full min-h-[280px]">
                <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                  </svg>
                </div>
                <p className="text-sm font-bold text-gray-700">Choose a date to begin</p>
                <p className="text-xs text-gray-400 mt-1.5">Available time slots will appear here</p>
              </div>
            ) : selectedTime ? (
              <BookingForm
                selectedDate={selectedDate}
                selectedTime={selectedTime}
                onSubmit={handleSubmit}
                onChangeTime={() => setSelectedTime(null)}
                submitting={submitting}
                error={submitError}
              />
            ) : (
              <TimeSlotGrid
                selectedDate={selectedDate}
                slots={slots}
                loading={loadingSlots}
                onSelect={setSelectedTime}
                blockedReasons={blockedReasons}
              />
            )}
          </div>

        </div>
      </div>

      <footer className="text-center py-10 text-xs text-gray-400">
        <span className="inline-flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
          </svg>
          Powered by ClinicCRM &nbsp;·&nbsp; Secure &amp; encrypted
        </span>
      </footer>
    </div>
  )
}
