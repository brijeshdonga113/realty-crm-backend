'use client'

import { useState, useEffect, useCallback } from 'react'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

function formatTime(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, '0')} ${period}`
}

function addDays(date, n) {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function toDateStr(date) {
  return date.toISOString().slice(0, 10)
}

export default function BookingPage({ params }) {
  const { slug } = params

  const [doctor, setDoctor]           = useState(null)
  const [workingHours, setWorkingHours] = useState(null)
  const [loadingInfo, setLoadingInfo] = useState(true)
  const [infoError, setInfoError]     = useState('')

  const [selectedDate, setSelectedDate] = useState(null)
  const [slots, setSlots]             = useState([])
  const [loadingSlots, setLoadingSlots] = useState(false)

  const [selectedTime, setSelectedTime] = useState(null)

  const [form, setForm] = useState({ name: '', phone: '', reason: '' })
  const [submitting, setSubmitting]   = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [confirmed, setConfirmed]     = useState(false)

  // Calendar nav
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date(today)
    return d
  })

  // Load doctor info on mount
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/booking/${slug}`)
        if (!res.ok) throw new Error('Doctor not found')
        const data = await res.json()
        setDoctor(data.doctor)
        setWorkingHours(data.workingHours)
      } catch (err) {
        setInfoError(err.message)
      } finally {
        setLoadingInfo(false)
      }
    }
    load()
  }, [doctorId])

  // Load slots when date selected
  const loadSlots = useCallback(async (dateStr) => {
    setLoadingSlots(true)
    setSlots([])
    setSelectedTime(null)
    try {
      const res = await fetch(`/api/booking/${slug}?date=${dateStr}`)
      const data = await res.json()
      setSlots(data.slots ?? [])
    } catch {
      setSlots([])
    } finally {
      setLoadingSlots(false)
    }
  }, [doctorId])

  const handleDateSelect = (date) => {
    setSelectedDate(date)
    setSelectedTime(null)
    loadSlots(toDateStr(date))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!selectedDate || !selectedTime) return
    setSubmitting(true)
    setSubmitError('')
    try {
      const res = await fetch(`/api/booking/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: toDateStr(selectedDate),
          time: selectedTime,
          name: form.name.trim(),
          phone: form.phone.trim(),
          reason: form.reason.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Booking failed')
      setConfirmed(true)
    } catch (err) {
      setSubmitError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // Build week days for the date picker
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const workDays = workingHours?.workDays ?? [1, 2, 3, 4, 5]

  const isWorkDay = (date) => {
    if (date < today) return false
    return workDays.includes(date.getDay())
  }

  // ── Loading / Error states ──────────────────────────────────────────────
  if (loadingInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3 text-gray-400">
          <svg className="animate-spin w-8 h-8" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          <p className="text-sm">Loading booking page…</p>
        </div>
      </div>
    )
  }

  if (infoError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3a9 9 0 100 18A9 9 0 0012 3z"/>
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-800 mb-1">Booking link not found</h2>
          <p className="text-sm text-gray-500">This booking link is invalid or has been removed.</p>
        </div>
      </div>
    )
  }

  // ── Confirmed screen ────────────────────────────────────────────────────
  if (confirmed) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">Appointment Confirmed!</h2>
          <p className="text-gray-500 text-sm mb-6">Your appointment has been booked successfully.</p>
          <div className="bg-gray-50 rounded-xl p-4 text-sm text-left space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-500">Doctor</span>
              <span className="font-medium text-gray-900">{doctor?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Clinic</span>
              <span className="font-medium text-gray-900">{doctor?.clinicName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Date</span>
              <span className="font-medium text-gray-900">
                {selectedDate && `${DAYS[selectedDate.getDay()]}, ${selectedDate.getDate()} ${MONTHS[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Time</span>
              <span className="font-medium text-gray-900">{selectedTime && formatTime(selectedTime)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Name</span>
              <span className="font-medium text-gray-900">{form.name}</span>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-6">Please arrive 5 minutes early. Contact the clinic if you need to reschedule.</p>
        </div>
      </div>
    )
  }

  // ── Main booking UI ─────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-7 h-7 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{doctor?.name || 'Doctor'}</h1>
              {doctor?.clinicName && <p className="text-sm text-gray-500">{doctor.clinicName}</p>}
              {doctor?.specialization && (
                <span className="inline-block mt-1 text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full capitalize">
                  {doctor.specialization.replace(/_/g, ' ')}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

        {/* Step 1 — Date picker */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50">
            <h2 className="font-semibold text-gray-900">Select a Date</h2>
          </div>
          <div className="p-5">
            {/* Week navigation */}
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => setWeekStart(d => addDays(d, -7))}
                disabled={weekDays[0] <= today}
                className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
                </svg>
              </button>
              <span className="text-sm font-medium text-gray-700">
                {MONTHS[weekDays[0].getMonth()]} {weekDays[0].getFullYear()}
              </span>
              <button
                onClick={() => setWeekStart(d => addDays(d, 7))}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1">
              {weekDays.map((date) => {
                const available = isWorkDay(date)
                const isSelected = selectedDate && toDateStr(date) === toDateStr(selectedDate)
                const isToday = toDateStr(date) === toDateStr(today)
                return (
                  <button
                    key={toDateStr(date)}
                    onClick={() => available && handleDateSelect(date)}
                    disabled={!available}
                    className={`flex flex-col items-center gap-1 py-3 rounded-xl text-xs font-medium transition-all
                      ${isSelected
                        ? 'bg-blue-500 text-white shadow-sm'
                        : available
                          ? 'hover:bg-blue-50 text-gray-700 cursor-pointer'
                          : 'text-gray-300 cursor-not-allowed'
                      }`}
                  >
                    <span className={`text-xs uppercase tracking-wide ${isSelected ? 'text-blue-100' : 'text-gray-400'}`}>
                      {DAYS[date.getDay()]}
                    </span>
                    <span className={`text-base font-bold ${isToday && !isSelected ? 'text-blue-500' : ''}`}>
                      {date.getDate()}
                    </span>
                  </button>
                )
              })}
            </div>

            {workingHours && (
              <p className="text-xs text-gray-400 mt-3 text-center">
                Available {workDays.map(d => DAYS[d]).join(', ')} · {formatTime(workingHours.start)} – {formatTime(workingHours.end)}
              </p>
            )}
          </div>
        </div>

        {/* Step 2 — Time slots */}
        {selectedDate && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-50">
              <h2 className="font-semibold text-gray-900">
                Available Times &nbsp;
                <span className="text-sm font-normal text-gray-400">
                  {DAYS[selectedDate.getDay()]}, {selectedDate.getDate()} {MONTHS[selectedDate.getMonth()]}
                </span>
              </h2>
            </div>
            <div className="p-5">
              {loadingSlots ? (
                <div className="flex items-center justify-center py-8 text-gray-400 gap-2">
                  <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  <span className="text-sm">Loading slots…</span>
                </div>
              ) : slots.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-8">No available slots for this day.</p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {slots.map(({ time, available }) => (
                    <button
                      key={time}
                      disabled={!available}
                      onClick={() => available && setSelectedTime(time)}
                      className={`py-2.5 rounded-xl text-sm font-medium transition-all border
                        ${!available
                          ? 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed line-through'
                          : selectedTime === time
                            ? 'bg-blue-500 text-white border-blue-500 shadow-sm'
                            : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                        }`}
                    >
                      {formatTime(time)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 3 — Booking form */}
        {selectedTime && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-50">
              <h2 className="font-semibold text-gray-900">Your Details</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Booking for {formatTime(selectedTime)} on {DAYS[selectedDate.getDay()]}, {selectedDate.getDate()} {MONTHS[selectedDate.getMonth()]}
              </p>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Enter your full name"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number <span className="text-red-400">*</span></label>
                <input
                  type="tel"
                  required
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="e.g. 9876543210"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason for visit <span className="text-gray-400 font-normal">(optional)</span></label>
                <textarea
                  value={form.reason}
                  onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                  placeholder="Brief description of your concern…"
                  rows={3}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all resize-none"
                />
              </div>

              {submitError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">{submitError}</p>
              )}

              <button
                type="submit"
                disabled={submitting || !form.name.trim() || !form.phone.trim()}
                className="w-full bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    Confirming…
                  </>
                ) : 'Confirm Appointment'}
              </button>
            </form>
          </div>
        )}

      </div>

      <footer className="text-center py-8 text-xs text-gray-400">
        Powered by ClinicCRM
      </footer>
    </div>
  )
}
