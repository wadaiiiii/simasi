import { corsHeaders, getContext, json } from '../_shared/auth.ts'

const ALLOWED_PRODI = ['Matematika', 'Statistika', 'Aktuaria', 'Bioteknologi']
const normalizeNim = (v: unknown) => String(v ?? '').trim().replace(/\s+/g, '').toUpperCase()
const normalizeProdi = (v: unknown) => ALLOWED_PRODI.find((p) => String(v ?? '').toLowerCase().includes(p.toLowerCase())) || ''

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ ok: false, message: 'Method not allowed' }, 405)
  try {
    const { profile, admin } = await getContext(req)
    if (profile.role !== 'admin') return json({ ok: false, message: 'Hanya admin yang dapat mengimpor mahasiswa.' }, 403)
    const body = await req.json()
    const students = Array.isArray(body.students) ? body.students.slice(0, 500) : []
    if (!students.length) return json({ ok: false, message: 'Tidak ada data mahasiswa untuk diimpor.' }, 400)

    let created = 0, updated = 0, failed = 0
    const errors: string[] = []

    for (const raw of students) {
      const nim = normalizeNim(raw.nim)
      const nama = String(raw.nama ?? '').trim()
      const prodi = normalizeProdi(raw.prodi)
      if (!nim || !nama || !prodi) {
        failed++; errors.push(`${nim || '(tanpa NIM)'}: NIM/Nama/Program Studi tidak valid`); continue
      }
      try {
        const { data: existingStudent, error: studentReadError } = await admin
          .from('mahasiswa').select('id,user_id').eq('nim', nim).maybeSingle()
        if (studentReadError) throw studentReadError

        let userId = existingStudent?.user_id || null
        let isNewAccount = false
        if (!userId) {
          const { data: byNim } = await admin.from('profiles').select('id').eq('nim', nim).maybeSingle()
          userId = byNim?.id || null
        }
        const internalEmail = `${nim.toLowerCase()}@students.simasi.local`
        if (!userId) {
          const { data: byEmail } = await admin.from('profiles').select('id').eq('email', internalEmail).maybeSingle()
          userId = byEmail?.id || null
        }
        if (!userId) {
          const { data: createdUser, error: createError } = await admin.auth.admin.createUser({
            email: internalEmail,
            password: nim,
            email_confirm: true,
            user_metadata: { full_name: nama, nim, prodi },
            app_metadata: { simasi_account_type: 'mahasiswa' }
          })
          if (createError || !createdUser.user) throw createError || new Error('Akun tidak berhasil dibuat')
          userId = createdUser.user.id
          isNewAccount = true
        }

        const studentData = {
          user_id: userId,
          nim,
          nama,
          jurusan: prodi === 'Bioteknologi' ? 'Ilmu Hayati' : 'Matematika',
          prodi,
          status: 'aktif'
        }
        let studentWrite
        if (existingStudent?.id) studentWrite = await admin.from('mahasiswa').update(studentData).eq('id', existingStudent.id)
        else studentWrite = await admin.from('mahasiswa').insert(studentData)
        if (studentWrite.error) throw studentWrite.error

        const profileUpdate: Record<string, unknown> = { full_name: nama, nim, prodi, role: 'mahasiswa' }
        if (isNewAccount) profileUpdate.must_change_password = true
        const profileWrite = await admin.from('profiles').update(profileUpdate).eq('id', userId)
        if (profileWrite.error) throw profileWrite.error

        if (isNewAccount) created++; else updated++
      } catch (error) {
        failed++
        errors.push(`${nim}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
    return json({ ok: true, created, updated, failed, errors })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return json({ ok: false, message }, message === 'Unauthorized' ? 401 : 500)
  }
})
