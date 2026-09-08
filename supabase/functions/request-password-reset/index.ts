import { createClient } from 'npm:@supabase/supabase-js@2.57.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

function readNamedKey(jsonName: string, legacyName: string): string {
  const encoded = Deno.env.get(jsonName)
  if (encoded) {
    try {
      const parsed = JSON.parse(encoded)
      if (typeof parsed?.default === 'string') return parsed.default
      const first = Object.values(parsed || {}).find((v) => typeof v === 'string')
      if (typeof first === 'string') return first
    } catch (_) {}
  }
  const legacy = Deno.env.get(legacyName)
  if (!legacy) throw new Error(`Missing ${jsonName}/${legacyName}`)
  return legacy
}

const normalizeNim = (value: unknown) => String(value ?? '').trim().replace(/\s+/g, '').toUpperCase()
const normalizeProdi = (value: unknown) => {
  const allowed = ['Matematika', 'Statistika', 'Aktuaria', 'Bioteknologi']
  const text = String(value ?? '').toLowerCase()
  return allowed.find((p) => text.includes(p.toLowerCase())) || ''
}
const genericMessage = 'Jika NIM/email terdaftar, permintaan reset password akan diteruskan ke pengelola SIMASI.'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ ok: false, message: 'Method not allowed' }, 405)

  try {
    const body = await req.json().catch(() => ({}))
    const rawIdentifier = String(body.identifier || '').trim()
    if (!rawIdentifier || rawIdentifier.length > 160) {
      return json({ ok: false, message: 'Masukkan NIM atau email yang valid.' }, 400)
    }

    const url = Deno.env.get('SUPABASE_URL')
    if (!url) throw new Error('Missing SUPABASE_URL')
    const secret = readNamedKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY')
    const admin = createClient(url, secret, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    })

    const isEmail = rawIdentifier.includes('@')
    const identifier = isEmail ? rawIdentifier.toLowerCase() : normalizeNim(rawIdentifier)
    let query = admin
      .from('profiles')
      .select('id,email,full_name,nim,prodi,role')
      .limit(1)

    query = isEmail ? query.eq('email', identifier) : query.eq('nim', identifier)
    const profileResult = await query.maybeSingle()

    // Deliberately return the same response when no account is found.
    if (profileResult.error || !profileResult.data) {
      return json({ ok: true, message: genericMessage })
    }

    const profile = profileResult.data
    const role = String(profile.role || '').toLowerCase()
    if (!['mahasiswa', 'dosen', 'staff', 'admin'].includes(role)) {
      return json({ ok: true, message: genericMessage })
    }

    const pending = await admin
      .from('password_reset_requests')
      .select('id')
      .eq('user_id', profile.id)
      .in('status', ['menunggu', 'diproses'])
      .limit(1)
      .maybeSingle()

    if (!pending.error && !pending.data) {
      const inserted = await admin.from('password_reset_requests').insert({
        user_id: profile.id,
        full_name: profile.full_name || null,
        nim: profile.nim || null,
        email: profile.email || null,
        role,
        prodi: normalizeProdi(profile.prodi) || profile.prodi || null,
        status: 'menunggu'
      })

      // Unique pending conflicts are intentionally treated as success.
      if (inserted.error && inserted.error.code !== '23505') {
        console.error('request-password-reset insert error', inserted.error)
      }
    }

    return json({ ok: true, message: genericMessage })
  } catch (error) {
    console.error('request-password-reset error', error)
    // Do not leak account state or backend detail through the public endpoint.
    return json({ ok: true, message: genericMessage })
  }
})
