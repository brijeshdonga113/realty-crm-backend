// TEMPORARY diagnostic route — reports the SHAPE of the Supabase env vars
// (length, first/last few chars, whether a value looks like two JWTs mashed
// together) without ever exposing the actual secret values. Delete this file
// once the env var issue is confirmed fixed — it should never ship long-term.

function inspect(value) {
  if (!value) return { present: false }
  const trimmed = value.trim()
  const hasLeadingTrailingWhitespace = trimmed !== value
  // A normal JWT has exactly 2 dots (3 segments). If there are 5 (two JWTs
  // concatenated with no separator), or the string is unusually long, flag it.
  const dotCount = (trimmed.match(/\./g) || []).length
  const eyJCount = (trimmed.match(/eyJ/g) || []).length
  return {
    present: true,
    length: value.length,
    first8: trimmed.slice(0, 8),
    last8: trimmed.slice(-8),
    dotCount,
    looksLikeSingleJwt: dotCount === 2,
    suspiciousDoubledToken: eyJCount > 1,
    hasLeadingTrailingWhitespace,
  }
}

export async function GET() {
  return Response.json({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || '(not set)',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: inspect(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    SUPABASE_SERVICE_ROLE_KEY: inspect(process.env.SUPABASE_SERVICE_ROLE_KEY),
  })
}
