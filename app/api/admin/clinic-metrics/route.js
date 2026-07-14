import { getAdminDb, getAdminAuth } from '@/lib/firebaseAdmin'
import { createAdminClient } from '@/lib/supabase'

async function verifyAdmin(request) {
  const idToken = (request.headers.get('Authorization') ?? '').replace('Bearer ', '').trim()
  if (!idToken) return null
  const adminAuth = await getAdminAuth()
  let decoded
  try { decoded = await adminAuth.verifyIdToken(idToken) } catch { return null }
  const db   = getAdminDb()
  const snap = await db.collection('users').doc(decoded.uid).collection('profile').doc('doctor').get()
  return snap.data()?.isAdmin ? decoded : null
}

// GET /api/admin/clinic-metrics?uid=xxx — last 100 aggregated usage windows
// for a clinic, whichever backend it's on. Lazily loaded (only fetched when
// the admin opens the Activity tab), separate from the main clinic overview.
export async function GET(request) {
  const caller = await verifyAdmin(request)
  if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const uid = new URL(request.url).searchParams.get('uid')
  if (!uid) return Response.json({ error: 'uid required' }, { status: 400 })

  try {
    const supabaseAdmin = createAdminClient()
    const { data: sbDoctor } = await supabaseAdmin.from('doctors').select('id').eq('id', uid).maybeSingle()

    if (sbDoctor) {
      const { data: rows } = await supabaseAdmin
        .from('request_metrics').select('*').eq('doctor_id', uid)
        .order('window_end', { ascending: false }).limit(100)
      const metrics = (rows ?? []).map(r => ({
        reads: r.reads, writes: r.writes, avgDurationMs: r.avg_duration_ms, maxDurationMs: r.max_duration_ms,
        windowStart: r.window_start, windowEnd: r.window_end,
      }))
      return Response.json({ metrics })
    }
  } catch (err) {
    console.error('[admin/clinic-metrics] Supabase lookup failed', err)
  }

  // No orderBy here deliberately — where()+orderBy() on different fields needs
  // a composite Firestore index; sorting the (small, capped) result in code
  // avoids requiring another index deploy for a lightweight telemetry feature.
  const db   = getAdminDb()
  const snap = await db.collection('requestMetrics').where('doctorId', '==', uid).limit(200).get()
  const metrics = snap.docs.map(d => d.data())
    .sort((a, b) => new Date(b.windowEnd) - new Date(a.windowEnd))
    .slice(0, 100)
  return Response.json({ metrics })
}
