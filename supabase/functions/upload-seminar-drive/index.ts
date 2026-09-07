import { corsHeaders, getContext, json } from '../_shared/auth.ts'
import { findOrCreateFolder, getDriveToken, uploadFile } from '../_shared/googleDrive.ts'

const ROOT_FOLDER_ID = Deno.env.get('GOOGLE_DRIVE_ROOT_FOLDER_ID') || '19Pi-nie5ODUBDeoPcnEMGVu-wkiPDwrv'
const ALLOWED_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png'])
const clean = (v: string) => v.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 120)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ ok: false, message: 'Method not allowed' }, 405)
  try {
    const { profile } = await getContext(req)
    if (profile.must_change_password) return json({ ok: false, message: 'Ganti password awal sebelum mengunggah berkas.' }, 403)
    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof File)) return json({ ok: false, message: 'File tidak ditemukan.' }, 400)
    if (file.size > 10 * 1024 * 1024) return json({ ok: false, message: 'Ukuran file maksimal 10 MB.' }, 400)
    if (!ALLOWED_TYPES.has(file.type)) return json({ ok: false, message: 'Format file harus PDF, JPG, atau PNG.' }, 400)

    const nim = String(form.get('nim') || '').trim().toUpperCase()
    const nama = String(form.get('nama') || '').trim()
    const prodi = String(form.get('prodi') || '').trim()
    const examType = String(form.get('exam_type') || '').trim()
    const registrationId = String(form.get('registration_id') || crypto.randomUUID())
    const documentKey = String(form.get('document_key') || 'dokumen')
    const documentLabel = String(form.get('document_label') || documentKey)
    if (profile.role === 'mahasiswa' && String(profile.nim || '').toUpperCase() !== nim) return json({ ok: false, message: 'NIM tidak sesuai dengan akun login.' }, 403)

    const token = await getDriveToken()
    const prodiFolder = await findOrCreateFolder(token, clean(prodi), ROOT_FOLDER_ID)
    const studentFolder = await findOrCreateFolder(token, clean(`${nim} - ${nama}`), prodiFolder)
    const examFolderName = examType === 'Ujian Tutup Skripsi' ? 'Seminar Hasil' : 'Seminar Proposal'
    const examFolder = await findOrCreateFolder(token, examFolderName, studentFolder)
    const submissionFolder = await findOrCreateFolder(token, `${new Date().toISOString().slice(0, 10)}_${registrationId.slice(0, 8)}`, examFolder)
    const ext = file.name.includes('.') ? `.${file.name.split('.').pop()}` : ''
    const finalName = clean(`${documentKey}_${documentLabel}`) + ext
    const uploaded = await uploadFile(token, submissionFolder, file, finalName)

    return json({
      ok: true,
      file_id: uploaded.id,
      file_name: uploaded.name,
      web_view_link: uploaded.webViewLink || `https://drive.google.com/file/d/${uploaded.id}/view`,
      folder_id: submissionFolder,
      root_folder_id: ROOT_FOLDER_ID
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return json({ ok: false, message }, message === 'Unauthorized' ? 401 : 500)
  }
})
