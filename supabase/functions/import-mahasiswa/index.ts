import { corsHeaders, getContext, json } from '../_shared/auth.ts'

const ALLOWED_PRODI = ['Matematika', 'Statistika', 'Aktuaria', 'Bioteknologi']
const normalizeNim = (v: unknown) => String(v ?? '').trim().replace(/\s+/g, '').toUpperCase()
const normalizeProdi = (v: unknown) => ALLOWED_PRODI.find((p) => String(v ?? '').toLowerCase().includes(p.toLowerCase())) || ''

async function findAuthUserByEmail(admin: any, email: string) {
  const wanted = email.toLowerCase()
  for (let page = 1; page <= 10; page++) {
    const listed = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (listed.error) throw listed.error
    const found = listed.data.users.find((u: any) => String(u.email || '').toLowerCase() === wanted)
    if (found) return found
    if (listed.data.users.length < 200) break
  }
  return null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ ok: false, message: 'Method not allowed' }, 405)

  try {
    const { profile, admin } = await getContext(req)
    if (String(profile.role || '').toLowerCase() !== 'admin') {
      return json({ ok: false, message: 'Hanya admin yang dapat mengimpor mahasiswa.' }, 403)
    }

    const body = await req.json()
    const students = Array.isArray(body.students) ? body.students.slice(0, 500) : []
    if (!students.length) return json({ ok: false, message: 'Tidak ada data mahasiswa untuk diimpor.' }, 400)

    let created = 0
    let updated = 0
    let failed = 0
    const errors: string[] = []
    const rows: Array<Record<string, unknown>> = []

    for (const raw of students) {
      const nim = normalizeNim(raw?.nim)
      const nama = String(raw?.nama ?? '').trim()
      const prodi = normalizeProdi(raw?.prodi)

      if (!nim || !nama || !prodi) {
        failed++
        const message = 'NIM/Nama/Program Studi tidak valid'
        errors.push(`${nim || '(tanpa NIM)'}: ${message}`)
        rows.push({ nim, ok: false, status: 'gagal', message })
        continue
      }

      try {
        const internalEmail = `${nim.toLowerCase()}@students.simasi.local`
        const { data: existingStudent, error: studentReadError } = await admin
          .from('mahasiswa')
          .select('id,user_id')
          .eq('nim', nim)
          .maybeSingle()
        if (studentReadError) throw studentReadError

        let userId = existingStudent?.user_id || null
        let isNewAccount = false

        if (userId) {
          const authCheck = await admin.auth.admin.getUserById(userId)
          if (authCheck.error || !authCheck.data?.user) userId = null
        }

        if (!userId) {
          const { data: byNim, error: byNimError } = await admin
            .from('profiles')
            .select('id')
            .eq('nim', nim)
            .maybeSingle()
          if (byNimError) throw byNimError
          userId = byNim?.id || null
        }

        if (!userId) {
          const { data: byEmail, error: byEmailError } = await admin
            .from('profiles')
            .select('id')
            .eq('email', internalEmail)
            .maybeSingle()
          if (byEmailError) throw byEmailError
          userId = byEmail?.id || null
        }

        if (!userId) {
          const existingAuth = await findAuthUserByEmail(admin, internalEmail)
          userId = existingAuth?.id || null
        }

        if (!userId) {
          const createdUser = await admin.auth.admin.createUser({
            email: internalEmail,
            password: nim,
            email_confirm: true,
            user_metadata: { full_name: nama, nim, prodi },
            app_metadata: { simasi_account_type: 'mahasiswa' }
          })
          if (createdUser.error || !createdUser.data.user) {
            throw createdUser.error || new Error('Akun Auth tidak berhasil dibuat')
          }
          userId = createdUser.data.user.id
          isNewAccount = true
        } else {
          const synced = await admin.auth.admin.updateUserById(userId, {
            email: internalEmail,
            email_confirm: true,
            user_metadata: { full_name: nama, nim, prodi },
            app_metadata: { simasi_account_type: 'mahasiswa' }
          })
          if (synced.error) throw synced.error
        }

        const profileWrite = await admin.from('profiles').upsert({
          id: userId,
          email: internalEmail,
          full_name: nama,
          nim,
          prodi,
          role: 'mahasiswa',
          ...(isNewAccount ? { must_change_password: true } : {})
        }, { onConflict: 'id' })
        if (profileWrite.error) throw profileWrite.error

        const studentData = {
          user_id: userId,
          nim,
          nama,
          jurusan: prodi === 'Bioteknologi' ? 'Ilmu Hayati' : 'Matematika',
          prodi,
          status: 'aktif'
        }

        let studentWrite
        if (existingStudent?.id) {
          studentWrite = await admin.from('mahasiswa').update(studentData).eq('id', existingStudent.id)
        } else {
          studentWrite = await admin.from('mahasiswa').insert(studentData)
        }
        if (studentWrite.error) throw studentWrite.error

        if (isNewAccount) created++
        else updated++
        rows.push({ nim, ok: true, status: isNewAccount ? 'dibuat' : 'diperbarui' })
      } catch (error) {
        failed++
        const message = error instanceof Error ? error.message : String(error)
        errors.push(`${nim}: ${message}`)
        rows.push({ nim, ok: false, status: 'gagal', message })
      }
    }

    return json({
      ok: true,
      created,
      updated,
      failed,
      errors,
      rows,
      message: failed ? `Import selesai dengan ${failed} data gagal.` : 'Import mahasiswa berhasil.'
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const status = message === 'Unauthorized' ? 401 : message === 'Profile not found' ? 403 : 500
    return json({ ok: false, message }, status)
  }
})
