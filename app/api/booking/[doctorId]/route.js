import { getAdminDb } from '@/lib/firebaseAdmin'

const DEFAULT_WORKING_HOURS = {
  start: '09:00',
  end: '17:00',
  slotMinutes: 30,
  workDays: [1, 2, 3, 4, 5], // Mon–Fri
}

function generateSlots(start, end, slotMinutes) {
  const slots = []
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  let cur = sh * 60 + sm
  const endMin = eh * 60 + em
  while (cur + slotMinutes <= endMin) {
    const h = String(Math.floor(cur / 60)).padStart(2, '0')
    const m = String(cur % 60).padStart(2, '0')
    slots.push(`${h}:${m}`)
    cur += slotMinutes
  }
  return slots
}

// GET /api/booking/[doctorId]?date=YYYY-MM-DD
export async function GET(request, { params }) {
  const { doctorId } = await params
  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date')

  try {
    const db = getAdminDb()

    // Fetch doctor profile
    const doctorSnap = await db.collection('users').doc(doctorId).get()
    if (!doctorSnap.exists) {
      return Response.json({ error: 'Doctor not found' }, { status: 404 })
    }
    const doctor = doctorSnap.data()

    const wh = { ...DEFAULT_WORKING_HOURS, ...(doctor.workingHours ?? {}) }

    // If no date requested, just return doctor info + working hours
    if (!date) {
      return Response.json({
        doctor: {
          name: [doctor.firstName, doctor.lastName].filter(Boolean).join(' '),
          clinicName: doctor.clinicName ?? '',
          specialization: doctor.specialization ?? '',
        },
        workingHours: wh,
      })
    }

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return Response.json({ error: 'Invalid date format' }, { status: 400 })
    }

    // Check if requested day is a work day
    const dayOfWeek = new Date(date + 'T00:00:00').getDay()
    if (!wh.workDays.includes(dayOfWeek)) {
      return Response.json({ slots: [], workingHours: wh })
    }

    // Fetch existing appointments for this date
    const apptSnap = await db
      .collection('users')
      .doc(doctorId)
      .collection('appointments')
      .where('date', '==', date)
      .where('status', 'in', ['scheduled', 'confirmed'])
      .get()

    const bookedTimes = new Set(apptSnap.docs.map(d => d.data().time))

    // Fetch blocked slots for this date
    const blockedSnap = await db
      .collection('users')
      .doc(doctorId)
      .collection('blockedSlots')
      .where('date', '==', date)
      .get()

    const blockedSlots = blockedSnap.docs.map(d => d.data())

    const allSlots = generateSlots(wh.start, wh.end, wh.slotMinutes)

    const slots = allSlots.map(time => {
      const isBooked = bookedTimes.has(time)
      const isBlocked = blockedSlots.some(b => {
        if (b.allDay) return true
        if (!b.startTime || !b.endTime) return false
        return time >= b.startTime && time < b.endTime
      })
      return { time, available: !isBooked && !isBlocked }
    })

    return Response.json({
      doctor: {
        name: [doctor.firstName, doctor.lastName].filter(Boolean).join(' '),
        clinicName: doctor.clinicName ?? '',
        specialization: doctor.specialization ?? '',
      },
      workingHours: wh,
      slots,
    })
  } catch (err) {
    console.error('Booking GET error:', err)
    return Response.json({ error: 'Server error' }, { status: 500 })
  }
}

// POST /api/booking/[doctorId]
export async function POST(request, { params }) {
  const { doctorId } = await params

  try {
    const { date, time, name, phone, reason } = await request.json()

    if (!date || !time || !name || !phone) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const db = getAdminDb()

    // Verify doctor exists
    const doctorSnap = await db.collection('users').doc(doctorId).get()
    if (!doctorSnap.exists) {
      return Response.json({ error: 'Doctor not found' }, { status: 404 })
    }

    // Check slot is still available
    const conflict = await db
      .collection('users')
      .doc(doctorId)
      .collection('appointments')
      .where('date', '==', date)
      .where('time', '==', time)
      .where('status', 'in', ['scheduled', 'confirmed'])
      .get()

    if (!conflict.empty) {
      return Response.json({ error: 'This slot is no longer available' }, { status: 409 })
    }

    const now = new Date().toISOString()
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`

    const doctor = doctorSnap.data()
    const wh = { ...DEFAULT_WORKING_HOURS, ...(doctor.workingHours ?? {}) }

    const appointment = {
      id,
      doctorId,
      patientId: '',
      patientName: name.trim(),
      patientPhone: String(phone).replace(/\D/g, ''),
      date,
      time,
      durationMinutes: wh.slotMinutes,
      type: 'consultation',
      reason: reason?.trim() ?? '',
      status: 'scheduled',
      notes: '',
      visitRecordId: null,
      source: 'booking_link',
      createdAt: now,
      updatedAt: now,
    }

    await db
      .collection('users')
      .doc(doctorId)
      .collection('appointments')
      .doc(id)
      .set(appointment)

    return Response.json({ success: true, appointmentId: id })
  } catch (err) {
    console.error('Booking POST error:', err)
    return Response.json({ error: 'Server error' }, { status: 500 })
  }
}
