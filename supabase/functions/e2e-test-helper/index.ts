import { createClient } from 'npm:@supabase/supabase-js@2.57.4'

function readNamedKey(jsonName: string, legacyName: string): string {
  const json = Deno.env.get(jsonName)
  if (json) {
    try {
      const parsed = JSON.parse(json)
      if (parsed.default) return parsed.default
      const first = Object.values(parsed)[0]
      if (typeof first === 'string') return first
    } catch (_) {}
  }
  const legacy = Deno.env.get(legacyName)
  if (!legacy) throw new Error(`Missing ${jsonName}/${legacyName}`)
  return legacy
}

const headers = { 'Content-Type': 'application/json' }
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers })

Deno.serve(async (req) => {
  try {
    const expected = Deno.env.get('SIMASI_E2E_TOKEN')
    const provided = req.headers.get('x-simasi-e2e-token')
    if (!expected || provided !== expected) return reply({ ok: false, message: 'Forbidden' }, 403)
    if (req.method !== 'POST') return reply({ ok: false, message: 'Method not allowed' }, 405)

    const url = Deno.env.get('SUPABASE_URL')!
    const publishable = readNamedKey('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY')
    const secret = readNamedKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY')
    const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } })
    const scoped = createClient(url, publishable, { auth: { persistSession: false, autoRefreshToken: false } })
    const body = await req.json()
    const action = String(body.action || '')

    if (action === 'create_admin') {
      const email = String(body.email || '').trim().toLowerCase()
      const password = String(body.password || '')
      if (!email.endsWith('@students.simasi.local') || password.length < 12) return reply({ ok: false, message: 'Invalid test admin' }, 400)
      const { data: created, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: 'Admin Uji SIMASI' } })
      if (error || !created.user) throw error || new Error('Failed to create admin')
      const { error: profileError } = await admin.from('profiles').update({ full_name: 'Admin Uji SIMASI', role: 'admin', must_change_password: false }).eq('id', created.user.id)
      if (profileError) throw profileError
      const { data: session, error: loginError } = await scoped.auth.signInWithPassword({ email, password })
      if (loginError || !session.session) throw loginError || new Error('Failed to sign in test admin')
      return reply({ ok: true, user_id: created.user.id, access_token: session.session.access_token, public_key: publishable })
    }

    if (action === 'sign_in') {
      const email = String(body.email || '').trim().toLowerCase()
      const password = String(body.password || '')
      const { data, error } = await scoped.auth.signInWithPassword({ email, password })
      if (error || !data.session || !data.user) throw error || new Error('Failed to sign in')
      return reply({ ok: true, user_id: data.user.id, access_token: data.session.access_token, public_key: publishable })
    }

    if (action === 'cleanup') {
      const adminId = String(body.admin_user_id || '')
      const studentId = String(body.student_user_id || '')
      const nim = String(body.nim || '').trim().toUpperCase()
      if (studentId) await admin.from('pendaftaran_seminar').delete().eq('user_id', studentId)
      if (nim) await admin.from('mahasiswa').delete().eq('nim', nim)
      if (studentId) await admin.auth.admin.deleteUser(studentId)
      if (adminId) await admin.auth.admin.deleteUser(adminId)
      return reply({ ok: true })
    }

    return reply({ ok: false, message: 'Unknown action' }, 400)
  } catch (error) {
    return reply({ ok: false, message: error instanceof Error ? error.message : String(error) }, 500)
  }
})
