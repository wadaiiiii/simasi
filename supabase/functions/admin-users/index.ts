import { corsHeaders, getContext, json } from '../_shared/auth.ts'

const ALLOWED_ROLES = ['mahasiswa', 'staff', 'dosen', 'admin']
const ALLOWED_PRODI = ['Matematika', 'Statistika', 'Aktuaria', 'Bioteknologi']

function createTemporaryPassword(): string {
  const value = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000
  return `SIMASI@${String(value).padStart(6, '0')}`
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
      const targetProfile = await admin.from('profiles').select('prodi').eq('id', userId).maybeSingle()
      if (targetProfile.error) throw targetProfile.error
      if (['staff', 'dosen'].includes(newRole) && !ALLOWED_PRODI.includes(String(targetProfile.data?.prodi || ''))) {
        return json({ ok: false, message: 'Tetapkan Program Studi terlebih dahulu sebelum mengubah role menjadi Staff/Dosen.' }, 400)
      }
      const updated = await admin.from('profiles').update({ role: newRole }).eq('id', userId)
      if (updated.error) throw updated.error
      return json({ ok: true, message: 'Role user diperbarui.' })
    }

    if (action === 'reset_password') {
      const email = String(body.email || '').trim().toLowerCase()
      if (!email.includes('@')) return json({ ok: false, message: 'Email user tidak valid.' }, 400)

      const authUser = await findAuthUserByEmail(admin, email)
      if (!authUser) return json({ ok: false, message: 'Akun Auth tidak ditemukan.' }, 404)
      if (authUser.id === user.id) return json({ ok: false, message: 'Password akun admin yang sedang digunakan tidak dapat direset dari sesi yang sama.' }, 400)

      const profileResult = await admin.from('profiles').select('id,email,full_name,nim,prodi,role').eq('id', authUser.id).maybeSingle()
      if (profileResult.error) throw profileResult.error
      const target = profileResult.data
      if (!target) return json({ ok: false, message: 'Profil user tidak ditemukan.' }, 404)

      const targetRole = String(target.role || '').toLowerCase()
      const temporaryPassword = targetRole === 'mahasiswa'
        ? String(target.nim || '').trim()
        : createTemporaryPassword()

      if (!temporaryPassword) return json({ ok: false, message: 'NIM mahasiswa belum tersedia sehingga password tidak dapat direset.' }, 400)

      const authUpdate = await admin.auth.admin.updateUserById(authUser.id, { password: temporaryPassword })
      if (authUpdate.error) throw authUpdate.error

      const profileUpdate = await admin.from('profiles').update({ must_change_password: true }).eq('id', authUser.id)
      if (profileUpdate.error) throw profileUpdate.error

      const username = targetRole === 'mahasiswa' ? String(target.nim || '') : String(target.email || authUser.email || email)
      return json({
        ok: true,
        user_id: authUser.id,
        full_name: target.full_name || authUser.user_metadata?.full_name || null,
        email: target.email || authUser.email || email,
        username,
        nim: target.nim || null,
        role: targetRole,
        prodi: target.prodi || null,
        temporary_password: temporaryPassword,
        must_change_password: true,
        message: targetRole === 'mahasiswa'
          ? 'Password mahasiswa direset ke NIM dan wajib diganti saat login pertama.'
          : 'Password sementara baru dibuat dan wajib diganti saat login pertama.'
      })
    }

    if (action === 'create_staff') {
      const email = String(body.email || '').trim().toLowerCase()
      const fullName = String(body.full_name || '').trim()
      const requestedRole = String(body.role || 'staff')
      const requestedProdi = ['staff', 'dosen'].includes(requestedRole) ? String(body.prodi || '').trim() : ''
      if (!email.includes('@') || !fullName || !['staff', 'dosen', 'admin'].includes(requestedRole)) return json({ ok: false, message: 'Nama, email, atau role staf tidak valid.' }, 400)
      if (['staff', 'dosen'].includes(requestedRole) && !ALLOWED_PRODI.includes(requestedProdi)) return json({ ok: false, message: 'Program studi Staff/Dosen wajib dipilih dan harus valid.' }, 400)

      const temporaryPassword = createTemporaryPassword()
      let authUser = await findAuthUserByEmail(admin, email)
      let userId = authUser?.id || null

      if (!userId) {
        const created = await admin.auth.admin.createUser({
          email,
          password: temporaryPassword,
          email_confirm: true,
          user_metadata: { full_name: fullName, prodi: requestedProdi || null },
          app_metadata: { simasi_account_type: requestedRole, simasi_prodi: requestedProdi || null }
        })
        if (created.error || !created.data.user) throw created.error || new Error('Akun staf gagal dibuat.')
        userId = created.data.user.id
        authUser = created.data.user
      } else {
        const authUpdate = await admin.auth.admin.updateUserById(userId, {
          password: temporaryPassword,
          email_confirm: true,
          user_metadata: { ...(authUser?.user_metadata || {}), full_name: fullName, prodi: requestedProdi || null },
          app_metadata: { ...(authUser?.app_metadata || {}), simasi_account_type: requestedRole, simasi_prodi: requestedProdi || null }
        })
        if (authUpdate.error) throw authUpdate.error
      }

      const profileWrite = await admin.from('profiles').upsert({
        id: userId,
        email,
        full_name: fullName,
        role: requestedRole,
        prodi: ['staff', 'dosen'].includes(requestedRole) ? requestedProdi : null,
        must_change_password: true
      }, { onConflict: 'id' })
      if (profileWrite.error) throw profileWrite.error

      return json({
        ok: true,
        user_id: userId,
        email,
        username: email,
        prodi: requestedProdi || null,
        role: requestedRole,
        temporary_password: temporaryPassword,
        must_change_password: true,
        message: 'Akun pengguna siap. Password sementara ditampilkan satu kali kepada admin dan tidak dikirim melalui email.'
      })
    }

    return json({ ok: false, message: 'Aksi tidak dikenali.' }, 400)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return json({ ok: false, message }, message === 'Unauthorized' ? 401 : 500)
  }
})
