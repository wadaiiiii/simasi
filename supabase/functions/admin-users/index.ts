import { createClient } from 'npm:@supabase/supabase-js@2.57.4'
import { corsHeaders, getContext, json } from '../_shared/auth.ts'

const SITE_URL = 'https://simasimipa.vercel.app'
const ALLOWED_ROLES = ['mahasiswa', 'dosen', 'admin']

function readNamedKey(jsonName: string, legacyName: string): string {
  const raw = Deno.env.get(jsonName)
  if (raw) {
    try {
      const parsed = JSON.parse(raw)
      if (typeof parsed.default === 'string') return parsed.default
      const first = Object.values(parsed)[0]
      if (typeof first === 'string') return first
    } catch (_) {}
  }
  const legacy = Deno.env.get(legacyName)
  if (!legacy) throw new Error(`Missing ${jsonName}/${legacyName}`)
  return legacy
}

async function findAuthUserByEmail(admin: any, email: string) {
  for (let page = 1; page <= 10; page++) {
    const result = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (result.error) throw result.error
    const found = result.data.users.find((user: any) => String(user.email || '').toLowerCase() === email.toLowerCase())
    if (found) return found
    if (result.data.users.length < 200) break
  }
  return null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ ok: false, message: 'Method not allowed' }, 405)

  try {
    const { user, profile, admin } = await getContext(req)
    if (profile.role !== 'admin') return json({ ok: false, message: 'Hanya admin yang dapat mengelola user.' }, 403)
    const body = await req.json().catch(() => ({}))
    const action = String(body.action || 'list')

    if (action === 'list') {
      const profileResult = await admin.from('profiles').select('id,email,full_name,nim,prodi,role,must_change_password,created_at').order('created_at', { ascending: false })
      if (profileResult.error) throw profileResult.error
      const authUsers: any[] = []
      for (let page = 1; page <= 10; page++) {
        const result = await admin.auth.admin.listUsers({ page, perPage: 200 })
        if (result.error) throw result.error
        authUsers.push(...result.data.users)
        if (result.data.users.length < 200) break
      }
      const authMap = new Map(authUsers.map((u: any) => [u.id, u]))
      const users = (profileResult.data || []).map((p: any) => {
        const au: any = authMap.get(p.id)
        return {
          id: p.id,
          email: p.email || au?.email || null,
          full_name: p.full_name || au?.user_metadata?.full_name || null,
          nim: p.nim || null,
          prodi: p.prodi || null,
          role: p.role,
          must_change_password: Boolean(p.must_change_password),
          created_at: p.created_at,
          last_sign_in_at: au?.last_sign_in_at || null,
          email_confirmed_at: au?.email_confirmed_at || null
        }
      })
      return json({ ok: true, users })
    }

    if (action === 'set_role') {
      const userId = String(body.user_id || '')
      const newRole = String(body.role || '')
      if (!userId || !ALLOWED_ROLES.includes(newRole)) return json({ ok: false, message: 'User atau role tidak valid.' }, 400)
      if (userId === user.id && newRole !== 'admin') return json({ ok: false, message: 'Admin tidak dapat menurunkan role akun sendiri.' }, 400)
      const updated = await admin.from('profiles').update({ role: newRole }).eq('id', userId)
      if (updated.error) throw updated.error
      return json({ ok: true, message: 'Role user diperbarui.' })
    }

    const url = Deno.env.get('SUPABASE_URL')!
    const publishable = readNamedKey('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY')
    const publicClient = createClient(url, publishable, { auth: { persistSession: false, autoRefreshToken: false } })

    if (action === 'reset_password') {
      const email = String(body.email || '').trim().toLowerCase()
      if (!email.includes('@')) return json({ ok: false, message: 'Email tidak valid.' }, 400)
      const reset = await publicClient.auth.resetPasswordForEmail(email, { redirectTo: SITE_URL })
      if (reset.error) throw reset.error
      return json({ ok: true, message: 'Email reset password telah dikirim.' })
    }

    if (action === 'create_staff') {
      const email = String(body.email || '').trim().toLowerCase()
      const fullName = String(body.full_name || '').trim()
      const requestedRole = String(body.role || 'dosen')
      if (!email.includes('@') || !fullName || !['dosen', 'admin'].includes(requestedRole)) return json({ ok: false, message: 'Nama, email, atau role staf tidak valid.' }, 400)

      let authUser = await findAuthUserByEmail(admin, email)
      let userId = authUser?.id || null
      if (!userId) {
        const randomPassword = `A9!${crypto.randomUUID()}`
        const created = await admin.auth.admin.createUser({
          email,
          password: randomPassword,
          email_confirm: true,
          user_metadata: { full_name: fullName },
          app_metadata: { simasi_account_type: requestedRole }
        })
        if (created.error || !created.data.user) throw created.error || new Error('Akun staf gagal dibuat.')
        userId = created.data.user.id
        authUser = created.data.user
      } else {
        const authUpdate = await admin.auth.admin.updateUserById(userId, {
          email_confirm: true,
          user_metadata: { ...(authUser?.user_metadata || {}), full_name: fullName },
          app_metadata: { ...(authUser?.app_metadata || {}), simasi_account_type: requestedRole }
        })
        if (authUpdate.error) throw authUpdate.error
      }

      const profileWrite = await admin.from('profiles').upsert({
        id: userId,
        email,
        full_name: fullName,
        role: requestedRole,
        must_change_password: true
      }, { onConflict: 'id' })
      if (profileWrite.error) throw profileWrite.error

      const reset = await publicClient.auth.resetPasswordForEmail(email, { redirectTo: SITE_URL })
      if (reset.error) throw reset.error
      return json({ ok: true, user_id: userId, message: 'Akun staf siap dan email pengaturan password telah dikirim.' })
    }

    return json({ ok: false, message: 'Aksi tidak dikenali.' }, 400)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return json({ ok: false, message }, message === 'Unauthorized' ? 401 : 500)
  }
})
