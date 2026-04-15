/**
 * googleCalendar.js
 *
 * Google Calendar integration using Google Identity Services (GIS).
 * Handles OAuth2 token flow and Calendar REST API calls.
 *
 * Setup:
 *   1. Google Cloud Console → Enable "Google Calendar API"
 *   2. Credentials → Create OAuth 2.0 Client ID (Web application)
 *   3. Add your domain to "Authorized JavaScript origins"
 *   4. Set NEXT_PUBLIC_GOOGLE_CLIENT_ID in .env.local
 */

const SCOPES        = 'https://www.googleapis.com/auth/calendar.events'
const CALENDAR_ID   = 'primary'
const TOKEN_KEY     = 'gcal_access_token'
const EXPIRY_KEY    = 'gcal_token_expiry'
const CONNECTED_KEY = 'gcal_connected' // persists across token expiry

export const isGoogleCalendarEnabled = !!(
  typeof process !== 'undefined' && process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
)

/* ─── Token helpers ─── */

function saveToken(token) {
  localStorage.setItem(TOKEN_KEY, token.access_token)
  // tokens expire in 3600s; save expiry with 5min buffer
  localStorage.setItem(EXPIRY_KEY, Date.now() + (token.expires_in - 300) * 1000)
  localStorage.setItem(CONNECTED_KEY, '1') // permanent flag — survives token expiry
}

function getToken() {
  const token  = localStorage.getItem(TOKEN_KEY)
  const expiry = localStorage.getItem(EXPIRY_KEY)
  if (!token || !expiry) return null
  if (Date.now() > Number(expiry)) return null // expired
  return token
}

// True if the user has ever authorized — even if the current token has expired
export function isGoogleCalendarConnected() {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(CONNECTED_KEY) === '1'
}

export function disconnectGoogleCalendar() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(EXPIRY_KEY)
  localStorage.removeItem(CONNECTED_KEY)
}

/* ─── Load GIS script ─── */

function loadGIS() {
  return new Promise((resolve) => {
    if (window.google?.accounts) return resolve()
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.onload = resolve
    document.head.appendChild(script)
  })
}

/* ─── OAuth2 token request ─── */

// Silently refresh expired token — never shows a popup
async function silentRefresh() {
  await loadGIS()
  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
      scope:     SCOPES,
      prompt:    'none', // no popup — fails fast if session expired
      callback:  (response) => {
        if (response.error) return reject(new Error(response.error))
        saveToken(response)
        resolve(response.access_token)
      },
    })
    client.requestAccessToken({ prompt: 'none' })
  })
}

// Returns a valid token, silently refreshing if expired. Never shows a popup.
// Throws if the user hasn't connected or the session has fully expired.
export async function getValidToken() {
  const cached = getToken()
  if (cached) return cached
  return silentRefresh()
}

// Full OAuth flow — shows the Google account picker
export async function connectGoogleCalendar() {
  await loadGIS()
  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
      scope:     SCOPES,
      callback:  (response) => {
        if (response.error) return reject(new Error(response.error))
        saveToken(response)
        resolve(response.access_token)
      },
    })
    client.requestAccessToken({ prompt: '' })
  })
}

/* ─── Calendar API helpers ─── */

async function calendarFetch(path, options = {}) {
  const token = await getValidToken()
  const res   = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${CALENDAR_ID}/${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type':  'application/json',
      ...(options.headers ?? {}),
    },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message ?? `Google Calendar API error ${res.status}`)
  }
  if (res.status === 204) return null
  return res.json()
}

function pad(n) { return String(n).padStart(2, '0') }

function toGCalEvent(appointment) {
  const tz       = Intl.DateTimeFormat().resolvedOptions().timeZone
  const time     = appointment.time || '09:00'
  const startISO = `${appointment.date}T${time}:00`
  // Compute end time in local time — toISOString() would give UTC, causing a skewed range
  const endDate  = new Date(startISO)
  endDate.setMinutes(endDate.getMinutes() + (appointment.durationMinutes ?? 30))
  const endISO   = `${endDate.getFullYear()}-${pad(endDate.getMonth()+1)}-${pad(endDate.getDate())}T${pad(endDate.getHours())}:${pad(endDate.getMinutes())}:00`

  return {
    summary:     `${appointment.patientName} — ${appointment.type?.replace('_', ' ') ?? 'Appointment'}`,
    description: [
      appointment.reason    ? `Reason: ${appointment.reason}`   : '',
      appointment.notes     ? `Notes: ${appointment.notes}`     : '',
    ].filter(Boolean).join('\n'),
    start: { dateTime: startISO, timeZone: tz },
    end:   { dateTime: endISO,   timeZone: tz },
    colorId: appointment.status === 'cancelled' ? '11' :  // red
             appointment.status === 'completed'  ? '8'  :  // graphite
             '1',                                           // lavender/default
  }
}

/* ─── Public API ─── */

export async function createCalendarEvent(appointment) {
  const event = await calendarFetch('events', {
    method: 'POST',
    body:   JSON.stringify(toGCalEvent(appointment)),
  })
  return event.id // Google event ID — save this on the appointment
}

export async function updateCalendarEvent(googleEventId, appointment) {
  await calendarFetch(`events/${googleEventId}`, {
    method: 'PATCH',
    body:   JSON.stringify(toGCalEvent(appointment)),
  })
}

export async function deleteCalendarEvent(googleEventId) {
  await calendarFetch(`events/${googleEventId}`, { method: 'DELETE' })
}
