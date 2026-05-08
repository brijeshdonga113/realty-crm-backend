'use client'

import { useState, useEffect, useMemo } from 'react'
import { formatTime, toDateStr } from '@/lib/booking'

const DAYS   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

function addDays(date, n) {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Spinner({ size = 5 }) {
  return (
    <svg className={`animate-spin w-${size} h-${size}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
    </svg>
  )
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-3 text-gray-400">
        <Spinner size={8} />
        <p className="text-sm">Loading booking page…</p>
      </div>
    </div>
  )
}

function ErrorScreen({ status }) {
  const isServerError = status >= 500
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center p-8">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3a9 9 0 100 18A9 9 0 0012 3z"/>
          </svg>
        </div>
        {isServerError ? (
          <>
            <h2 className="text-lg font-semibold text-gray-800 mb-1">Server configuration error</h2>
            <p className="text-sm text-gray-500">The booking service is not properly configured. Please contact the clinic.</p>
          </>
        ) : (
          <>
            <h2 className="text-lg font-semibold text-gray-800 mb-1">Booking link not found</h2>
            <p className="text-sm text-gray-500">This booking link is invalid or has been removed.</p>
          </>
        )}
      </div>
    </div>
  )
}

function BookingHeader({ doctor }) {
  const hasLogo = !!doctor.logoUrl

  if (hasLogo) {
    return (
      <div className="bg-white shadow-sm">
        <div className="h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />
        <div className="max-w-5xl mx-auto px-4 py-6">
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-2xl bg-white border border-gray-100 shadow-md flex items-center justify-center p-2 flex-shrink-0 overflow-hidden">
              <img
                src={doctor.logoUrl}
                alt={doctor.clinicName || 'Clinic logo'}
                className="w-full h-full object-contain"
                onError={e => { e.currentTarget.style.display = 'none' }}
              />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                {doctor.clinicName || doctor.name || 'Clinic'}
              </h1>
              {doctor.name && (
                <p className="text-sm text-gray-500 mt-0.5">Dr. {doctor.name}</p>
              )}
              {doctor.specialization && (
                <span className="inline-block mt-2 text-xs font-semibold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full capitalize">
                  {doctor.specialization.replace(/_/g, ' ')}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white border-b border-gray-100">
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
            <svg className="w-7 h-7 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{doctor.name || 'Doctor'}</h1>
            {doctor.clinicName && <p className="text-sm text-gray-500">{doctor.clinicName}</p>}
            {doctor.specialization && (
              <span className="inline-block mt-1 text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full capitalize">
                {doctor.specialization.replace(/_/g, ' ')}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function ConfirmedScreen({ doctor, selectedDate, selectedTime, patientName }) {
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
          {[
            ['Doctor',  doctor.name],
            ['Clinic',  doctor.clinicName],
            ['Date',    `${DAYS[selectedDate.getDay()]}, ${selectedDate.getDate()} ${MONTHS[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`],
            ['Time',    formatTime(selectedTime)],
            ['Name',    patientName],
          ].map(([label, value]) => value ? (
            <div key={label} className="flex justify-between">
              <span className="text-gray-500">{label}</span>
              <span className="font-medium text-gray-900">{value}</span>
            </div>
          ) : null)}
        </div>
        <p className="text-xs text-gray-400 mt-6">Please arrive 5 minutes early. Contact the clinic if you need to reschedule.</p>
      </div>
    </div>
  )
}

function DatePicker({ today, workingHours, selectedDate, onSelect }) {
  const [weekStart, setWeekStart] = useState(today)
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])
  const workDays = workingHours?.workDays ?? [1, 2, 3, 4, 5]

  const isAvailable = (date) => date >= today && workDays.includes(date.getDay())

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden h-full">
      <div className="px-5 py-4 border-b border-gray-50">
        <h2 className="font-semibold text-gray-900">Select a Date</h2>
        {workingHours && (
          <p className="text-xs text-gray-400 mt-0.5">
            {workDays.map(d => DAYS[d]).join(', ')} · {formatTime(workingHours.start)} – {formatTime(workingHours.end)}
          </p>
        )}
      </div>
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setWeekStart(d => addDays(d, -7))}
            disabled={toDateStr(weekDays[0]) <= toDateStr(today)}
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
          {weekDays.map(date => {
            const available = isAvailable(date)
            const selected  = selectedDate && toDateStr(date) === toDateStr(selectedDate)
            const isToday   = toDateStr(date) === toDateStr(today)
            return (
              <button
                key={toDateStr(date)}
                onClick={() => available && onSelect(date)}
                disabled={!available}
                className={`flex flex-col items-center gap-1 py-3 rounded-xl text-xs font-medium transition-all
                  ${selected
                    ? 'bg-blue-500 text-white shadow-sm'
                    : available
                      ? 'hover:bg-blue-50 text-gray-700'
                      : 'text-gray-300 cursor-not-allowed'}`}
              >
                <span className={`text-xs uppercase tracking-wide ${selected ? 'text-blue-100' : 'text-gray-400'}`}>
                  {DAYS[date.getDay()]}
                </span>
                <span className={`text-base font-bold ${isToday && !selected ? 'text-blue-500' : ''}`}>
                  {date.getDate()}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function TimeSlotGrid({ selectedDate, slots, loading, selectedTime, onSelect, blockedReasons = [] }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-50">
        <h2 className="font-semibold text-gray-900">
          Available Times
        </h2>
        <p className="text-xs text-gray-400 mt-0.5">
          {DAYS[selectedDate.getDay()]}, {selectedDate.getDate()} {MONTHS[selectedDate.getMonth()]}
        </p>
      </div>
      <div className="p-5">
        {blockedReasons.length > 0 && (
          <div className="mb-4 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 space-y-0.5">
            <p className="text-xs font-semibold text-amber-700">Limited availability</p>
            {blockedReasons.map((reason, i) => (
              <p key={i} className="text-xs text-amber-600">{reason}</p>
            ))}
          </div>
        )}
        {loading ? (
          <div className="flex items-center justify-center py-8 text-gray-400 gap-2">
            <Spinner size={5} />
            <span className="text-sm">Loading slots…</span>
          </div>
        ) : slots.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-8">No available slots for this day.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {slots.map(({ time, available }) => (
              <button
                key={time}
                disabled={!available}
                onClick={() => available && onSelect(time)}
                className={`py-2.5 rounded-xl text-sm font-medium transition-all border
                  ${!available
                    ? 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed line-through'
                    : selectedTime === time
                      ? 'bg-blue-500 text-white border-blue-500 shadow-sm'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300 hover:bg-blue-50'}`}
              >
                {formatTime(time)}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function BookingForm({ selectedDate, selectedTime, onSubmit, onChangeTime, submitting, error }) {
  const [form, setForm] = useState({ name: '', phone: '', reason: '' })
  const update = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }))

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit(form)
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-50">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold text-gray-900">Your Details</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {DAYS[selectedDate.getDay()]}, {selectedDate.getDate()} {MONTHS[selectedDate.getMonth()]}
            </p>
          </div>
          {/* Selected time badge + change button */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="bg-blue-500 text-white text-sm font-semibold px-3 py-1 rounded-lg">
              {formatTime(selectedTime)}
            </span>
            <button
              type="button"
              onClick={onChangeTime}
              className="text-xs text-gray-400 hover:text-blue-500 transition-colors underline underline-offset-2"
            >
              Change
            </button>
          </div>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Full Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            required
            value={form.name}
            onChange={update('name')}
            placeholder="Enter your full name"
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Phone Number <span className="text-red-400">*</span>
          </label>
          <input
            type="tel"
            required
            value={form.phone}
            onChange={update('phone')}
            placeholder="e.g. 9876543210"
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Reason for visit <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <textarea
            value={form.reason}
            onChange={update('reason')}
            placeholder="Brief description of your concern…"
            rows={3}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all resize-none"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">{error}</p>
        )}

        <button
          type="submit"
          disabled={submitting || !form.name.trim() || !form.phone.trim()}
          className="w-full bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {submitting ? <><Spinner size={4} /> Confirming…</> : 'Confirm Appointment'}
        </button>
      </form>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BookingPage({ params }) {
  const { slug } = params

  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const [pageState, setPageState] = useState('loading') // loading | error | booking | confirmed
  const [errorStatus, setErrorStatus] = useState(0)
  const [doctor, setDoctor]       = useState(null)
  const [workingHours, setWorkingHours] = useState(null)

  const [selectedDate, setSelectedDate]     = useState(null)
  const [slots, setSlots]                   = useState([])
  const [blockedReasons, setBlockedReasons] = useState([])
  const [loadingSlots, setLoadingSlots]     = useState(false)
  const [selectedTime, setSelectedTime]     = useState(null)

  const [submitError, setSubmitError]   = useState('')
  const [submitting, setSubmitting]     = useState(false)
  const [confirmedName, setConfirmedName] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    fetch(`/api/booking/${slug}`, { signal: controller.signal })
      .then(res => {
        if (!res.ok) {
          const err = new Error()
          err.status = res.status
          throw err
        }
        return res.json()
      })
      .then(data => {
        setDoctor(data.doctor)
        setWorkingHours(data.workingHours)
        setPageState('booking')
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          setErrorStatus(err.status ?? 500)
          setPageState('error')
        }
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
      setSlots([])
      setBlockedReasons([])
    } finally {
      setLoadingSlots(false)
    }
  }

  const handleSubmit = async (form) => {
    setSubmitting(true)
    setSubmitError('')
    try {
      const res = await fetch(`/api/booking/${slug}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date:   toDateStr(selectedDate),
          time:   selectedTime,
          name:   form.name.trim(),
          phone:  form.phone.trim(),
          reason: form.reason.trim(),
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
    <ConfirmedScreen
      doctor={doctor}
      selectedDate={selectedDate}
      selectedTime={selectedTime}
      patientName={confirmedName}
    />
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <BookingHeader doctor={doctor} />

      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Left column: calendar */}
          <div>
            <DatePicker
              today={today}
              workingHours={workingHours}
              selectedDate={selectedDate}
              onSelect={handleDateSelect}
            />
          </div>

          {/* Right column: time slots → booking form */}
          <div>
            {!selectedDate ? (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center py-16 px-6 text-center h-full">
                <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mb-4">
                  <svg className="w-7 h-7 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-600">Select a date</p>
                <p className="text-xs text-gray-400 mt-1">Available times will appear here</p>
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
                selectedTime={selectedTime}
                onSelect={setSelectedTime}
                blockedReasons={blockedReasons}
              />
            )}
          </div>

        </div>
      </div>

      <footer className="text-center py-8 text-xs text-gray-400">
        Powered by ClinicCRM
      </footer>
    </div>
  )
}
