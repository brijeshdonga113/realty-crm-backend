import { getAdminDb } from '@/lib/firebaseAdmin'
import { createAdminClient } from '@/lib/supabase'
import { normalizeWorkingHours, generateSlotsFromWorkingHours } from '@/lib/booking'
import { DEFAULT_THEME } from '@/lib/themes'

// A booking slug's backend isn't knowable up front (no session exists on this
// public, unauthenticated route) — look it up in both backends in parallel
// and use whichever resolves. Two indexed point-reads per page load is
// negligible; no slug-prefix scheme needed.

async function firestoreLookupSlug(slug) {
  try {
    const db = getAdminDb()
    const slugSnap = await db.collection('bookingSlugs').doc(slug).get()
    if (!slugSnap.exists) return null
    const { doctorId } = slugSnap.data()
    if (!doctorId) return null
    const profileSnap = await db.collection('users').doc(doctorId).collection('profile').doc('doctor').get()
    if (!profileSnap.exists) return null
    return { backend: 'FB', doctorId, profile: profileSnap.data() }
  } catch (err) {
    console.error('[booking] Firestore slug lookup failed', err)
    return null
  }
}

function supabaseProfileToDoctorShape(row) {
  return {
    firstName: row.first_name ?? '', lastName: row.last_name ?? '', clinicName: row.clinic_name ?? '',
    specialization: row.specialization ?? '', logoUrl: row.logo_url ?? '', paymentQrUrl: row.payment_qr_url ?? '',
    colorTheme: row.color_theme ?? DEFAULT_THEME, workingHours: row.working_hours ?? null,
  }
}

async function supabaseLookupSlug(slug) {
  try {
    const supabaseAdmin = createAdminClient()
    const { data: slugRow } = await supabaseAdmin.from('booking_slugs').select('doctor_id').eq('slug', slug).maybeSingle()
    if (!slugRow) return null
    const { data: doctorRow } = await supabaseAdmin.from('doctors').select('*').eq('id', slugRow.doctor_id).maybeSingle()
    if (!doctorRow) return null
    return { backend: 'SB', doctorId: slugRow.doctor_id, profile: supabaseProfileToDoctorShape(doctorRow) }
  } catch (err) {
    console.error('[booking] Supabase slug lookup failed', err)
    return null
  }
}

async function resolveBooking(slug) {
  const [fb, sb] = await Promise.all([firestoreLookupSlug(slug), supabaseLookupSlug(slug)])
  return fb ?? sb ?? null
}

function doctorInfo(profile) {
  return {
    name:           [profile.firstName, profile.lastName].filter(Boolean).join(' '),
    clinicName:     profile.clinicName     ?? '',
    specialization: profile.specialization ?? '',
    logoUrl:        profile.logoUrl        ?? '',
    paymentQrUrl:   profile.paymentQrUrl   ?? '',
    colorTheme:     profile.colorTheme     ?? DEFAULT_THEME,
  }
}

function workingHours(profile) {
  return normalizeWorkingHours(profile.workingHours ?? {})
}

async function findBookedAndBlocked(backend, doctorId, date) {
  if (backend === 'SB') {
    const supabaseAdmin = createAdminClient()
    const [{ data: appts }, { data: blocked }] = await Promise.all([
      supabaseAdmin.from('appointments').select('data').eq('doctor_id', doctorId)
        .filter('data->>date', 'eq', date).filter('data->>status', 'in', '("scheduled","confirmed")'),
      supabaseAdmin.from('blocked_slots').select('data').eq('doctor_id', doctorId).filter('data->>date', 'eq', date),
    ])
    return {
      bookedTimes: new Set((appts ?? []).map(r => r.data.time)),
      blockedSlots: (blocked ?? []).map(r => r.data),
    }
  }

  const db = getAdminDb()
  const [apptSnap, blockedSnap] = await Promise.all([
    db.collection('users').doc(doctorId).collection('appointments')
      .where('date', '==', date).where('status', 'in', ['scheduled', 'confirmed']).get(),
    db.collection('users').doc(doctorId).collection('blockedSlots').where('date', '==', date).get(),
  ])
  return {
    bookedTimes: new Set(apptSnap.docs.map(d => d.data().time)),
    blockedSlots: blockedSnap.docs.map(d => d.data()),
  }
}

// GET /api/booking/[slug]?date=YYYY-MM-DD
// Returns doctor info + working hours, and optionally available slots for a date.
export async function GET(request, { params }) {
  const { slug }       = await params
  const { searchParams } = new URL(request.url)
  const date           = searchParams.get('date')

  try {
    const booking = await resolveBooking(slug)
    if (!booking) return Response.json({ error: 'Booking link not found' }, { status: 404 })

    const { backend, doctorId, profile } = booking
    const wh = workingHours(profile)

    if (!date) {
      return Response.json({ doctor: doctorInfo(profile), workingHours: wh })
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return Response.json({ error: 'Invalid date format' }, { status: 400 })
    }

    const dayOfWeek = new Date(`${date}T00:00:00`).getDay()
    if (!wh.workDays.includes(dayOfWeek)) {
      return Response.json({ doctor: doctorInfo(profile), workingHours: wh, slots: [] })
    }

    const { bookedTimes, blockedSlots } = await findBookedAndBlocked(backend, doctorId, date)
    const blockedReasons = [...new Set(blockedSlots.map(b => b.reason).filter(Boolean))]

    const slots = generateSlotsFromWorkingHours(wh).map(time => {
      const isBooked  = bookedTimes.has(time)
      const isBlocked = blockedSlots.some(b => {
        if (b.allDay) return true
        if (!b.startTime || !b.endTime) return false
        return time >= b.startTime && time < b.endTime
      })
      // For today (UTC), also mark slots in the past as unavailable
      const nowUTC     = new Date()
      const todayUTC   = nowUTC.toISOString().slice(0, 10)
      const currentHHMM = `${String(nowUTC.getUTCHours()).padStart(2, '0')}:${String(nowUTC.getUTCMinutes()).padStart(2, '0')}`
      const isPast     = date === todayUTC && time <= currentHHMM
      return { time, available: !isBooked && !isBlocked && !isPast }
    })

    return Response.json({ doctor: doctorInfo(profile), workingHours: wh, slots, blockedReasons })
  } catch (err) {
    console.error('[booking GET]', err)
    return Response.json({ error: 'Server error' }, { status: 500 })
  }
}

// POST /api/booking/[slug]
// Creates an appointment after verifying the slot is still free.
export async function POST(request, { params }) {
  const { slug } = await params

  try {
    const { date, time, name, phone, reason } = await request.json()

    if (!date || !time || !name?.trim() || !phone?.trim()) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Validate phone — exactly 10 digits
    const phoneDigits = phone.replace(/\D/g, '')
    if (phoneDigits.length !== 10) {
      return Response.json({ error: 'Please enter a valid 10-digit phone number.' }, { status: 400 })
    }

    // Reject bookings in the past
    const nowUTC = new Date()
    const todayUTC = nowUTC.toISOString().slice(0, 10)
    if (date < todayUTC) {
      return Response.json({ error: 'Cannot book an appointment in the past.' }, { status: 400 })
    }

    const booking = await resolveBooking(slug)
    if (!booking) return Response.json({ error: 'Booking link not found' }, { status: 404 })

    const { backend, doctorId, profile } = booking
    const wh  = workingHours(profile)
    const now = new Date().toISOString()
    const id  = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
    const notifId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`

    const appointment = {
      id, doctorId,
      patientId:      '',
      patientName:    name.trim(),
      patientPhone:   phone.replace(/\D/g, ''),
      date, time,
      durationMinutes: wh.slotMinutes,
      type:           'consultation',
      reason:         reason?.trim() ?? '',
      status:         'scheduled',
      notes:          '',
      visitRecordId:  null,
      source:         'booking_link',
      createdAt:      now,
      updatedAt:      now,
    }
    const notification = {
      id: notifId, doctorId,
      type:          'appointment_new',
      title:         'New appointment booked',
      body:          `${name.trim()} booked a ${date} appointment at ${time}${reason?.trim() ? ` — ${reason.trim()}` : ''}`,
      relatedEntity: { type: 'appointment', id },
      read:          false,
      createdAt:     now,
      createdByRole: 'patient',
      createdByUid:  null,
    }

    if (backend === 'SB') {
      const supabaseAdmin = createAdminClient()
      const { data: conflictRows } = await supabaseAdmin.from('appointments').select('id').eq('doctor_id', doctorId)
        .filter('data->>date', 'eq', date).filter('data->>time', 'eq', time).filter('data->>status', 'in', '("scheduled","confirmed")')
      if (conflictRows?.length) return Response.json({ error: 'This slot is no longer available' }, { status: 409 })

      await Promise.all([
        supabaseAdmin.from('appointments').insert({ doctor_id: doctorId, id, data: appointment, created_at: now, updated_at: now }),
        supabaseAdmin.from('notifications').insert({ doctor_id: doctorId, id: notifId, data: notification, created_at: now, updated_at: now }),
      ])
      return Response.json({ success: true, appointmentId: id })
    }

    const db = getAdminDb()
    const conflict = await db.collection('users').doc(doctorId).collection('appointments')
      .where('date', '==', date).where('time', '==', time).where('status', 'in', ['scheduled', 'confirmed']).get()
    if (!conflict.empty) return Response.json({ error: 'This slot is no longer available' }, { status: 409 })

    await Promise.all([
      db.collection('users').doc(doctorId).collection('appointments').doc(id).set(appointment),
      db.collection('users').doc(doctorId).collection('notifications').doc(notifId).set(notification),
    ])

    return Response.json({ success: true, appointmentId: id })
  } catch (err) {
    console.error('[booking POST]', err)
    return Response.json({ error: 'Server error' }, { status: 500 })
  }
}
