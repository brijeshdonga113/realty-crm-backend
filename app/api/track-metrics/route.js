import { getAdminDb } from '@/lib/firebaseAdmin'
import { createAdminClient } from '@/lib/supabase'
import { verifyBearerToken } from '@/lib/serverAuth'

// POST /api/track-metrics — receives one AGGREGATED usage summary per ~60s
// window per active session (see the flush loop in lib/dataStore.js), not a
// record per individual read/write — that would double write volume and
// defeat the point of tracking cost in the first place. Best-effort: a
// failure here should never surface to the user or affect the app.
export async function POST(request) {
  const caller = await verifyBearerToken(request)
  if (!caller) return Response.json({ ok: false }, { status: 401 })

  let body
  try { body = await request.json() } catch { return Response.json({ ok: false }, { status: 400 }) }

  const { doctorId, reads, writes, avgDurationMs, maxDurationMs, windowStart, windowEnd } = body
  if (!doctorId) return Response.json({ ok: false }, { status: 400 })

  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`

  try {
    if (caller.backend === 'SB') {
      await createAdminClient().from('request_metrics').insert({
        id, doctor_id: doctorId, backend: 'SB',
        reads: reads ?? 0, writes: writes ?? 0,
        avg_duration_ms: avgDurationMs ?? 0, max_duration_ms: maxDurationMs ?? 0,
        window_start: windowStart, window_end: windowEnd,
        created_at: new Date().toISOString(),
      })
    } else {
      await getAdminDb().collection('requestMetrics').doc(id).set({
        id, doctorId, backend: 'FB',
        reads: reads ?? 0, writes: writes ?? 0,
        avgDurationMs: avgDurationMs ?? 0, maxDurationMs: maxDurationMs ?? 0,
        windowStart, windowEnd,
        createdAt: new Date().toISOString(),
      })
    }
    return Response.json({ ok: true })
  } catch (err) {
    console.error('[track-metrics]', err)
    return Response.json({ ok: false })
  }
}
