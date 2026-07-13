import { createAdminClient } from '@/lib/supabase'

// POST /api/join-sb — receptionist self-signup for a Supabase-backed clinic.
// Mirrors context/AuthContext.jsx's signupReceptionist() Firebase flow, but
// needs a server route: Supabase's public signUp() requires email
// confirmation before login works, unlike Firebase's immediate-login
// createUserWithEmailAndPassword. email_confirm:true keeps the same
// immediate-login UX. The invite code itself was already validated by the
// caller (it looked the code up to find doctorId before calling this route).
export async function POST(request) {
  const { name, email, password, doctorId } = await request.json()
  if (!name?.trim() || !email?.trim() || !password?.trim() || !doctorId) {
    return Response.json({ error: 'Missing required fields.' }, { status: 400 })
  }

  try {
    const supabaseAdmin = createAdminClient()

    const { data: userData, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email:         email.trim(),
      password:      password.trim(),
      email_confirm: true,
    })
    if (createErr) throw createErr

    const uid = userData.user.id
    const { error: insertErr } = await supabaseAdmin.from('receptionists').insert({
      id:         uid,
      doctor_id:  doctorId,
      name:       name.trim(),
      email:      email.trim(),
      role:       'receptionist',
      created_at: new Date().toISOString(),
    })
    if (insertErr) {
      // Roll back the auth user so the caller can retry with the same email
      await supabaseAdmin.auth.admin.deleteUser(uid).catch(() => {})
      throw insertErr
    }

    return Response.json({ uid })
  } catch (err) {
    const msg = err.message?.includes('already been registered')
      ? 'An account with this email already exists.'
      : (err.message || 'Failed to create account.')
    return Response.json({ error: msg }, { status: 400 })
  }
}
