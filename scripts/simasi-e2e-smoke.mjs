import { execFileSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { writeFileSync } from 'node:fs'

const ref = process.env.SUPABASE_PROJECT_REF || 'jdptpfpmelmaviucaioq'
const url = process.env.SUPABASE_URL || `https://${ref}.supabase.co`
const mgmtToken = process.env.SUPABASE_ACCESS_TOKEN
if (!mgmtToken) throw new Error('Missing SUPABASE_ACCESS_TOKEN')

const runId = process.env.GITHUB_RUN_ID || Date.now().toString()
const e2eToken = randomBytes(32).toString('hex')
const adminPassword = `A9!${randomBytes(20).toString('hex')}`
const newStudentPassword = `S9!${randomBytes(20).toString('hex')}`
const testNim = `T${runId}`
const adminEmail = `e2e-admin-${runId}@students.simasi.local`
const studentEmail = `${testNim.toLowerCase()}@students.simasi.local`

for (const value of [e2eToken, adminPassword, newStudentPassword]) console.log(`::add-mask::${value}`)

function cli(args, quiet = false) {
  return execFileSync('supabase', args, {
    encoding: 'utf8',
    stdio: quiet ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    env: { ...process.env, SUPABASE_ACCESS_TOKEN: mgmtToken }
  })
}

async function jsonFetch(endpoint, options = {}) {
  const res = await fetch(endpoint, options)
  const text = await res.text()
  let body = {}
  try { body = text ? JSON.parse(text) : {} } catch { body = { raw: text } }
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${body?.message || body?.error || 'request failed'}`)
  return body
}

async function helper(action, payload = {}) {
  return jsonFetch(`${url}/functions/v1/e2e-test-helper`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-simasi-e2e-token': e2eToken },
    body: JSON.stringify({ action, ...payload })
  })
}

let adminUserId = ''
let studentUserId = ''
let publicKey = ''
let drivePath = ''

try {
  cli(['secrets', 'set', '--project-ref', ref, `SIMASI_E2E_TOKEN=${e2eToken}`])
  cli(['functions', 'deploy', 'e2e-test-helper', '--project-ref', ref, '--no-verify-jwt'])

  // Bersihkan residu percobaan lama yang sempat berhenti sebelum student_user_id tersimpan.
  try { await helper('cleanup', { nim: 'T34114638797' }) } catch {}

  const admin = await helper('create_admin', { email: adminEmail, password: adminPassword })
  adminUserId = admin.user_id
  publicKey = admin.public_key
  const adminToken = admin.access_token
  console.log(`::add-mask::${adminToken}`)
  console.log(`::add-mask::${publicKey}`)

  const imported = await jsonFetch(`${url}/functions/v1/import-mahasiswa`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${adminToken}`, apikey: publicKey },
    body: JSON.stringify({ students: [{ nim: testNim, nama: 'Mahasiswa Uji SIMASI', prodi: 'Matematika' }] })
  })
  if (!imported.ok || imported.created !== 1) throw new Error(`Import mahasiswa tidak sesuai: ${JSON.stringify(imported)}`)
  console.log('PASS import-mahasiswa')

  const student = await helper('sign_in', { email: studentEmail, password: testNim })
  studentUserId = student.user_id
  const studentToken = student.access_token
  console.log(`::add-mask::${studentToken}`)
  console.log('PASS login NIM/password awal NIM')

  const changed = await jsonFetch(`${url}/functions/v1/change-initial-password`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${studentToken}`, apikey: publicKey },
    body: JSON.stringify({ new_password: newStudentPassword })
  })
  if (!changed.ok) throw new Error('Ganti password awal gagal')
  console.log('PASS wajib ganti password')

  const registration = await jsonFetch(`${url}/rest/v1/pendaftaran_seminar`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Authorization: `Bearer ${studentToken}`,
      apikey: publicKey,
      Prefer: 'return=representation'
    },
    body: JSON.stringify({
      user_id: studentUserId,
      nim: testNim,
      nama: 'Mahasiswa Uji SIMASI',
      prodi: 'Matematika',
      jenis_ujian: 'Seminar Proposal',
      pas_foto_jumlah: 2,
      status: 'diajukan'
    })
  })
  const registrationId = registration?.[0]?.id
  if (!registrationId) throw new Error('Pendaftaran seminar tidak menghasilkan ID')
  console.log('PASS RLS pendaftaran seminar')

  const pdf = Buffer.from('%PDF-1.4\n% SIMASI E2E smoke test\n1 0 obj << /Type /Catalog >> endobj\n%%EOF\n')
  writeFileSync('/tmp/simasi-e2e.pdf', pdf)
  const form = new FormData()
  form.append('file', new Blob([pdf], { type: 'application/pdf' }), 'simasi-e2e.pdf')
  form.append('nim', testNim)
  form.append('nama', 'Mahasiswa Uji SIMASI')
  form.append('prodi', 'Matematika')
  form.append('exam_type', 'Seminar Proposal')
  form.append('registration_id', registrationId)
  form.append('document_key', 'e2e_smoke_test')
  form.append('document_label', 'Uji Backend SIMASI')

  const uploaded = await jsonFetch(`${url}/functions/v1/upload-seminar-drive`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${studentToken}`, apikey: publicKey },
    body: form
  })
  if (!uploaded.ok || !uploaded.file_id || !uploaded.folder_id) throw new Error('Upload Google Drive gagal')
  drivePath = `Matematika/${testNim} - Mahasiswa Uji SIMASI/Seminar Proposal/`
  console.log('PASS PDF -> Google Drive')

  const meta = await jsonFetch(`${url}/rest/v1/berkas_seminar`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Authorization: `Bearer ${studentToken}`,
      apikey: publicKey,
      Prefer: 'return=representation'
    },
    body: JSON.stringify({
      pendaftaran_id: registrationId,
      jenis_berkas: 'e2e_smoke_test',
      nama_berkas: 'SIMASI E2E Smoke Test.pdf',
      file_url: uploaded.web_view_link,
      status: 'terunggah',
      storage_provider: 'google_drive',
      drive_file_id: uploaded.file_id,
      drive_folder_id: uploaded.folder_id
    })
  })
  if (meta?.[0]?.storage_provider !== 'google_drive') throw new Error('Metadata Drive gagal disimpan')
  console.log('PASS metadata Drive -> database')

  const query = `select count(*) as n from public.berkas_seminar b join public.pendaftaran_seminar p on p.id=b.pendaftaran_id where p.nim='${testNim}' and b.storage_provider='google_drive' and b.drive_file_id is not null`
  const verified = await jsonFetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${mgmtToken}` },
    body: JSON.stringify({ query, read_only: true })
  })
  if (Number(verified?.[0]?.n) !== 1) throw new Error('Verifikasi database akhir gagal')

  console.log('SIMASI_E2E_RESULT=PASS')
  console.log(`SIMASI_E2E_TEST_NIM=${testNim}`)
  console.log(`SIMASI_E2E_DRIVE_PATH=${drivePath}`)
} finally {
  try { await helper('cleanup', { admin_user_id: adminUserId, student_user_id: studentUserId, nim: testNim }) } catch {}
  try { cli(['secrets', 'unset', 'SIMASI_E2E_TOKEN', '--project-ref', ref], true) } catch {}
  try { cli(['functions', 'delete', 'e2e-test-helper', '--project-ref', ref, '--yes'], true) } catch {}
}
