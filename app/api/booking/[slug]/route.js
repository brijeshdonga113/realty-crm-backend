import { getAdminDb } from '@/lib/firebaseAdmin'
import { DEFAULT_WORKING_HOURS, generateSlots } from '@/lib/booking'

async function resolveBooking(db, slug) {
  const slugSnap = await db.collection('bookingSlugs').doc(slug).get()
  if (!slugSnap.exists) {
    console.error(`[booking] bookingSlugs/${slug} not found`)
    return null
  }

  const { doctorId } = slugSnap.data()
  if (!doctorId) {
    console.error(`[booking] bookingSlugs/${slug} has no doctorId`)
    return null
  }

  const profileSnap = await db
    .collection('users').doc(doctorId)
    .collection('profile').doc('doctor')
    .get()

  if (!profileSnap.exists) {
    console.error(`[booking] users/${doctorId}/profile/doctor not found`)
    return null
  }

  return { doctorId, profile: profileSnap.data() }
}

function doctorInfo(profile) {
  return {
    name:           [profile.firstName, profile.lastName].filter(Boolean).join(' '),
    clinicName:     profile.clinicName     ?? '',
    specialization: profile.specialization ?? '',
    logoUrl:        profile.logoUrl        ?? '',
  }
}

function workingHours(profile) {
  return { ...DEFAULT_WORKING_HOURS, ...(profile.workingHours ?? {}) }
}

// GET /api/booking/[slug]?date=YYYY-MM-DD
// Returns doctor info + working hours, and optionally available slots for a date.
export async function GET(request, { params }) {
  const { slug }       = await params
  const { searchParams } = new URL(request.url)
  const date           = searchParams.get('date')

  if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
    console.error('[booking] Firebase Admin SDK env vars are not set (FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY)')
    return Response.json({ error: 'Server misconfiguration' }, { status: 500 })
  }

  try {
    const db      = getAdminDb()
    const booking = await resolveBooking(db, slug)
    if (!booking) return Response.json({ error: 'Booking link not found' }, { status: 404 })

    const { doctorId, profile } = booking
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

    // Fetch appointments and blocked slots in parallel
    const [apptSnap, blockedSnap] = await Promise.all([
      db.collection('users').doc(doctorId)
        .collection('appointments')
        .where('date', '==', date)
        .where('status', 'in', ['scheduled', 'confirmed'])
        .get(),
      db.collection('users').doc(doctorId)
        .collection('blockedSlots')
        .where('date', '==', date)
        .get(),
    ])

    const bookedTimes    = new Set(apptSnap.docs.map(d => d.data().time))
    const blockedSlots   = blockedSnap.docs.map(d => d.data())
    const blockedReasons = [...new Set(blockedSlots.map(b => b.reason).filter(Boolean))]

    const slots = generateSlots(wh.start, wh.end, wh.slotMinutes).map(time => {
      const isBooked  = bookedTimes.has(time)
      const isBlocked = blockedSlots.some(b => {
        if (b.allDay) return true
        if (!b.startTime || !b.endTime) return false
        return time >= b.startTime && time < b.endTime
      })
      return { time, available: !isBooked && !isBlocked }
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

  if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
    console.error('[booking] Firebase Admin SDK env vars are not set')
    return Response.json({ error: 'Server misconfiguration' }, { status: 500 })
  }

  try {
    const { date, time, name, phone, reason } = await request.json()

    if (!date || !time || !name?.trim() || !phone?.trim()) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const db      = getAdminDb()
    const booking = await resolveBooking(db, slug)
    if (!booking) return Response.json({ error: 'Booking link not found' }, { status: 404 })

    const { doctorId, profile } = booking

    const conflict = await db
      .collection('users').doc(doctorId)
      .collection('appointments')
      .where('date', '==', date)
      .where('time', '==', time)
      .where('status', 'in', ['scheduled', 'confirmed'])
      .get()

    if (!conflict.empty) {
      return Response.json({ error: 'This slot is no longer available' }, { status: 409 })
    }

    const wh  = workingHours(profile)
    const now = new Date().toISOString()
    const id  = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`

    const notifId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`

    await Promise.all([
      db.collection('users').doc(doctorId)
        .collection('appointments').doc(id)
        .set({
          id,
          doctorId,
          patientId:      '',
          patientName:    name.trim(),
          patientPhone:   phone.replace(/\D/g, ''),
          date,
          time,
          durationMinutes: wh.slotMinutes,
          type:           'consultation',
          reason:         reason?.trim() ?? '',
          status:         'scheduled',
          notes:          '',
          visitRecordId:  null,
          source:         'booking_link',
          createdAt:      now,
          updatedAt:      now,
        }),
      db.collection('users').doc(doctorId)
        .collection('notifications').doc(notifId)
        .set({
          id:            notifId,
          doctorId,
          type:          'appointment_new',
          title:         'New appointment booked',
          body:          `${name.trim()} booked a ${date} appointment at ${time}${reason?.trim() ? ` — ${reason.trim()}` : ''}`,
          relatedEntity: { type: 'appointment', id },
          read:          false,
          createdAt:     now,
          createdByRole: 'patient',
          createdByUid:  null,
        }),
    ])

    return Response.json({ success: true, appointmentId: id })
  } catch (err) {
    console.error('[booking POST]', err)
    return Response.json({ error: 'Server error' }, { status: 500 })
  }
}
