import { createClient } from 'npm:@supabase/supabase-js@2.57.4'

const headers = { 'Content-Type': 'application/json' }
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers })

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') return reply({ ok: false, message: 'Method not allowed' }, 405)
    const expected = Deno.env.get('SIMASI_BOOTSTRAP_TOKEN')
    const provided = req.headers.get('x-simasi-bootstrap-token')
    if (!expected || provided !== expected) return reply({ ok: false, message: 'Forbidden' }, 403)

    const url = Deno.env.get('SUPABASE_URL')!
    const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!
    const admin = createClient(url, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } })
    const publicClient = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } })
    const body = await req.json().catch(() => ({}))
    const email = String(body.email || '').trim().toLowerCase()
    const fullName = String(body.full_name || 'Administrator FMIPA').trim()
    const redirectTo = String(body.redirect_to || 'https://simasimipa.vercel.app').trim()
    if (!email.endsWith('@unsulbar.ac.id')) return reply({ ok: false, message: 'Admin harus menggunakan email Unsulbar.' }, 400)

    const existing = await admin.from('profiles').select('id').eq('email', email).maybeSingle()
    if (existing.error) throw existing.error
    let userId = existing.data?.id || null
    let created = false

    if (!userId) {
      const password = `A9!${crypto.randomUUID()}${crypto.randomUUID()}`
      const createdUser = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
        app_metadata: { simasi_account_type: 'admin' }
      })
      if (createdUser.error || !createdUser.data.user) throw createdUser.error || new Error('Akun admin gagal dibuat')
      userId = createdUser.data.user.id
      created = true
    }

    const profile = await admin.from('profiles').update({
      full_name: fullName,
      role: 'admin',
      must_change_password: true
    }).eq('id', userId)
    if (profile.error) throw profile.error

    const recovery = await publicClient.auth.resetPasswordForEmail(email, { redirectTo })
    if (recovery.error) throw recovery.error

    return reply({ ok: true, created, email_sent: true, message: 'Admin siap. Email pengaturan password telah dikirim.' })
  } catch (error) {
    return reply({ ok: false, message: error instanceof Error ? error.message : String(error) }, 500)
  }
})
