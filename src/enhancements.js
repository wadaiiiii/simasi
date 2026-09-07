import { supabaseClient, hasSupabaseConfiguration } from './supabase.js'

const $ = (s) => document.querySelector(s)
const $$ = (s) => [...document.querySelectorAll(s)]
const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#039;')

const PRODI = ['Matematika', 'Statistika', 'Aktuaria', 'Bioteknologi']
const BASE_DOCS = [
  ['persetujuan_ta', 'Halaman Persetujuan Tugas Akhir'],
  ['krs', 'Kartu Rencana Studi (KRS) Semester Terakhir'],
  ['khs', 'Kartu Hasil Studi (KHS) Semester Terakhir'],
  ['transkrip', 'Transkrip Nilai Terakhir'],
  ['ijazah', 'Fotocopy Ijazah SMA'],
  ['ktp', 'Fotocopy KTP'],
  ['kontrol_pembimbing', 'Kartu Kontrol Pembimbing'],
  ['kontrol_seminar', 'Kartu Kontrol Mengikuti Seminar'],
  ['sk_kegiatan', 'SK Kegiatan'],
  ['pas_foto', 'Pas Foto 3x4']
]
const EXTRA_DOCS = [
  ['rekomendasi_ujian', 'Surat Rekomendasi Ujian'],
  ['persetujuan_ujian', 'Halaman Persetujuan Ujian Akhir']
]

const extState = { user: null, profile: null, importRows: [] }

function normalizeNim(value) {
  return String(value ?? '').trim().replace(/\s+/g, '').toUpperCase()
}

function authEmailFromLogin(value) {
  const v = String(value ?? '').trim()
  return v.includes('@') ? v.toLowerCase() : `${normalizeNim(v).toLowerCase()}@students.simasi.local`
}

function normalizeProdi(value) {
  const s = String(value ?? '').trim().toLowerCase()
  return PRODI.find((p) => s.includes(p.toLowerCase())) || ''
}

function notify(message, type = 'ok') {
  const toast = $('#toast')
  if (!toast) return
  toast.textContent = message
  toast.className = `fixed bottom-5 right-5 z-[300] max-w-sm rounded-2xl px-5 py-4 text-sm font-semibold text-white shadow-2xl ${type === 'err' ? 'bg-rose-600' : type === 'info' ? 'bg-slate-900' : 'bg-emerald-600'}`
  toast.classList.remove('hidden')
  setTimeout(() => toast.classList.add('hidden'), 3800)
}

function setLoading(on, text = 'Memproses...') {
  const loading = $('#loading')
  if (!loading) return
  const box = loading.firstElementChild
  if (box) box.textContent = text
  loading.classList.toggle('hidden', !on)
  loading.classList.toggle('flex', on)
}

function showPageDirect(page) {
  $$('.page-view').forEach((node) => node.classList.remove('active'))
  $(`#page-${page}`)?.classList.add('active')
  $$('[data-page]').forEach((node) => node.classList.toggle('active', node.dataset.page === page))
  const titles = {
    dashboard: ['Dashboard', 'SIMASI'],
    login: ['Login', 'Autentikasi'],
    admin: ['Administrasi Mahasiswa', 'Admin SIMASI']
  }
  if (titles[page]) {
    $('#pageTitle').textContent = titles[page][0]
    $('#eyebrow').textContent = titles[page][1]
  }
  $('#sidebar')?.classList.add('-translate-x-full')
  $('#overlay')?.classList.add('hidden')
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function injectUi() {
  const nav = $('#sidebar nav')
  if (nav && !$('#adminImportMenu')) {
    const divider = [...nav.children].find((n) => n.classList?.contains('my-5'))
    const button = document.createElement('button')
    button.id = 'adminImportMenu'
    button.type = 'button'
    button.className = 'hidden w-full gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-white/10'
    button.innerHTML = '⇧ Import Data Mahasiswa'
    if (divider) nav.insertBefore(button, divider)
    else nav.appendChild(button)
  }

  const main = $('main')
  if (main && !$('#page-admin')) {
    main.insertAdjacentHTML('beforeend', `
      <section id="page-admin" class="page-view">
        <div class="rounded-3xl bg-gradient-to-r from-slate-950 via-[#0f2747] to-teal-900 p-7 text-white">
          <p class="text-xs font-bold uppercase tracking-[.18em] text-teal-200">Administrator SIMASI</p>
          <h1 class="mt-3 text-3xl font-black">Import Data Mahasiswa</h1>
          <p class="mt-2 max-w-3xl text-sm leading-6 text-slate-300">Upload Excel atau PDF yang memuat NIM, Nama, dan Program Studi. Akun baru dibuat otomatis dengan password awal sama dengan NIM dan wajib diganti saat login pertama.</p>
        </div>
        <div class="mt-6 grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
          <div class="rounded-3xl border bg-white p-6">
            <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div><h2 class="text-xl font-black">1. Pilih File</h2><p class="mt-1 text-sm text-slate-500">Format: .xlsx, .xls, .csv, atau PDF berbasis teks.</p></div>
              <button id="downloadStudentTemplate" type="button" class="rounded-xl border px-4 py-2 text-xs font-black">Unduh Template CSV</button>
            </div>
            <label class="mt-5 block cursor-pointer rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-8 text-center hover:border-teal-400 hover:bg-teal-50/40">
              <input id="studentImportFile" type="file" accept=".xlsx,.xls,.csv,.pdf" class="hidden">
              <div class="text-3xl">⇧</div><p class="mt-3 font-black">Pilih Excel / PDF</p><p id="studentImportFileName" class="mt-1 text-xs text-slate-500">Belum ada file dipilih.</p>
            </label>
            <div id="studentImportNotice" class="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-800">PDF scan berupa gambar belum dapat dibaca otomatis. Gunakan PDF dengan teks yang dapat diseleksi atau file Excel.</div>
          </div>
          <div class="rounded-3xl border bg-white p-6">
            <h2 class="text-xl font-black">2. Hasil Deteksi</h2>
            <div class="mt-5 grid grid-cols-3 gap-3 text-center"><div class="rounded-2xl bg-slate-50 p-4"><p class="text-[10px] font-bold uppercase text-slate-500">Baris Valid</p><p id="importValidCount" class="mt-1 text-2xl font-black">0</p></div><div class="rounded-2xl bg-slate-50 p-4"><p class="text-[10px] font-bold uppercase text-slate-500">Prodi</p><p id="importProdiCount" class="mt-1 text-2xl font-black">0</p></div><div class="rounded-2xl bg-slate-50 p-4"><p class="text-[10px] font-bold uppercase text-slate-500">Akun Baru</p><p class="mt-1 text-2xl font-black text-teal-700">NIM</p></div></div>
            <button id="executeStudentImport" type="button" disabled class="mt-5 w-full rounded-xl bg-teal-600 px-5 py-3 font-black text-white disabled:bg-slate-300">Import & Buat Akun Mahasiswa</button>
            <div id="studentImportResult" class="mt-4 hidden rounded-xl border p-4 text-sm"></div>
          </div>
        </div>
        <div class="mt-6 overflow-hidden rounded-3xl border bg-white"><div class="border-b p-5"><h3 class="font-black">Preview Data</h3><p class="mt-1 text-xs text-slate-500">Periksa hasil pembacaan sebelum menekan tombol Import.</p></div><div class="overflow-x-auto"><table class="min-w-full text-sm"><thead class="bg-slate-50"><tr><th class="p-4 text-left">No.</th><th class="p-4 text-left">NIM</th><th class="p-4 text-left">Nama</th><th class="p-4 text-left">Program Studi</th></tr></thead><tbody id="studentImportRows"><tr><td colspan="4" class="p-8 text-center text-slate-500">Belum ada data.</td></tr></tbody></table></div></div>
      </section>`)
  }

  if (!$('#initialPasswordModal')) {
    document.body.insertAdjacentHTML('beforeend', `
      <div id="initialPasswordModal" class="fixed inset-0 z-[500] hidden items-center justify-center bg-slate-950/70 p-4">
        <div class="w-full max-w-lg rounded-3xl bg-white p-7 shadow-2xl">
          <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-xl">🔐</div>
          <h2 class="mt-5 text-2xl font-black">Ganti Password Pertama</h2>
          <p class="mt-2 text-sm leading-6 text-slate-500">Password NIM hanya digunakan untuk login pertama. Buat password baru minimal 8 karakter sebelum mengakses layanan akademik.</p>
          <form id="initialPasswordForm" class="mt-6 space-y-4">
            <input id="initialNewPassword" type="password" minlength="8" required autocomplete="new-password" class="w-full rounded-xl border px-4 py-3" placeholder="Password baru (minimal 8 karakter)">
            <input id="initialNewPasswordConfirm" type="password" minlength="8" required autocomplete="new-password" class="w-full rounded-xl border px-4 py-3" placeholder="Ulangi password baru">
            <div id="initialPasswordMessage" class="hidden rounded-xl border p-3 text-sm"></div>
            <button class="w-full rounded-xl bg-teal-600 px-5 py-3 font-black text-white">Simpan Password Baru</button>
          </form>
        </div>
      </div>`)
  }

  const loginInput = $('#email')
  if (loginInput) {
    loginInput.type = 'text'
    loginInput.placeholder = 'NIM mahasiswa atau email staf'
    loginInput.autocomplete = 'username'
    loginInput.removeAttribute('inputmode')
  }
  const loginHeading = $('#page-login h2')
  if (loginHeading) loginHeading.textContent = 'Masuk ke SIMASI'
  const loginForm = $('#loginForm')
  if (loginForm && !$('#nimLoginHelp')) {
    loginForm.insertAdjacentHTML('beforebegin', '<div id="nimLoginHelp" class="mt-5 rounded-2xl border border-teal-100 bg-teal-50 p-4 text-xs leading-5 text-teal-900"><b>Mahasiswa:</b> login dengan NIM. Pada akun hasil import, password pertama adalah NIM dan wajib diganti setelah berhasil masuk.</div>')
  }

  const seminarTitle = $('#page-seminar h1')
  if (seminarTitle) seminarTitle.textContent = 'Seminar Proposal / Seminar Hasil'
  const seminarMenu = $('[data-page="seminar"]')
  if (seminarMenu) seminarMenu.textContent = '✓ Seminar Proposal / Seminar Hasil'
}

async function refreshAuthState() {
  if (!hasSupabaseConfiguration) return
  const { data } = await supabaseClient.auth.getSession()
  extState.user = data.session?.user || null
  extState.profile = null
  if (extState.user) {
    const result = await supabaseClient.from('profiles').select('*').eq('id', extState.user.id).maybeSingle()
    extState.profile = result.data || null
  }
  const admin = String(extState.profile?.role || '').toLowerCase() === 'admin'
  const menu = $('#adminImportMenu')
  if (menu) {
    menu.classList.toggle('hidden', !admin)
    menu.classList.toggle('flex', admin)
  }
  if (extState.profile?.must_change_password) openPasswordModal()
}

function openPasswordModal() {
  const modal = $('#initialPasswordModal')
  if (!modal) return
  modal.classList.remove('hidden')
  modal.classList.add('flex')
}

function closePasswordModal() {
  const modal = $('#initialPasswordModal')
  if (!modal) return
  modal.classList.add('hidden')
  modal.classList.remove('flex')
}

async function interceptLogin(event) {
  event.preventDefault()
  event.stopImmediatePropagation()
  if (!hasSupabaseConfiguration) {
    notify('Supabase belum dikonfigurasi pada Vercel.', 'err')
    return
  }
  const identifier = $('#email')?.value.trim() || ''
  const password = $('#password')?.value || ''
  if (!identifier || !password) return
  const btn = $('#loginBtn')
  btn.disabled = true
  btn.textContent = 'Memverifikasi...'
  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email: authEmailFromLogin(identifier), password })
    if (error) throw error
    extState.user = data.user
    await refreshAuthState()
    const msg = $('#loginMsg')
    if (msg) msg.classList.add('hidden')
    showPageDirect('dashboard')
    if (extState.profile?.must_change_password) {
      notify('Login berhasil. Ganti password awal untuk melanjutkan.', 'info')
      openPasswordModal()
    } else notify('Login berhasil.')
  } catch (error) {
    const msg = $('#loginMsg')
    if (msg) {
      msg.className = 'mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700'
      msg.textContent = error.message || 'Login gagal.'
      msg.classList.remove('hidden')
    }
  } finally {
    btn.disabled = false
    btn.textContent = 'Masuk'
  }
}

async function changeInitialPassword(event) {
  event.preventDefault()
  const password = $('#initialNewPassword').value
  const confirm = $('#initialNewPasswordConfirm').value
  const msg = $('#initialPasswordMessage')
  const setMsg = (text, error = true) => {
    msg.textContent = text
    msg.className = `rounded-xl border p-3 text-sm ${error ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`
    msg.classList.remove('hidden')
  }
  if (password.length < 8) return setMsg('Password baru minimal 8 karakter.')
  if (password !== confirm) return setMsg('Konfirmasi password tidak sama.')
  if (extState.profile?.nim && password.toUpperCase() === String(extState.profile.nim).toUpperCase()) return setMsg('Password baru tidak boleh sama dengan NIM.')
  setLoading(true, 'Mengganti password...')
  try {
    const { data, error } = await supabaseClient.functions.invoke('change-initial-password', { body: { new_password: password } })
    if (error) throw error
    if (!data?.ok) throw new Error(data?.message || 'Password gagal diperbarui.')
    extState.profile = { ...(extState.profile || {}), must_change_password: false }
    setMsg('Password berhasil diganti.', false)
    $('#initialPasswordForm').reset()
    setTimeout(() => closePasswordModal(), 350)
    notify('Password baru aktif. Semua layanan SIMASI sekarang dapat diakses.')
  } catch (error) {
    setMsg(error.message || 'Gagal mengganti password.')
  } finally {
    setLoading(false)
  }
}

function guardProtectedNavigation(event) {
  const target = event.target.closest?.('[data-page="kuliah"],[data-page="seminar"],[data-page="logbook"]')
  if (!target || !hasSupabaseConfiguration) return
  if (!extState.user) {
    event.preventDefault()
    event.stopImmediatePropagation()
    showPageDirect('login')
    notify('Silakan login terlebih dahulu.', 'info')
    return
  }
  if (extState.profile?.must_change_password) {
    event.preventDefault()
    event.stopImmediatePropagation()
    openPasswordModal()
    notify('Ganti password awal sebelum mengakses layanan ini.', 'info')
  }
}

function loadScript(src, globalName) {
  if (window[globalName]) return Promise.resolve(window[globalName])
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-simasi-lib="${globalName}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve(window[globalName]), { once: true })
      existing.addEventListener('error', reject, { once: true })
      return
    }
    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.dataset.simasiLib = globalName
    script.onload = () => resolve(window[globalName])
    script.onerror = () => reject(new Error(`Gagal memuat ${globalName}.`))
    document.head.appendChild(script)
  })
}

function rowsToStudents(rows) {
  const normalized = rows.map((r) => Array.isArray(r) ? r.map((v) => String(v ?? '').trim()) : [])
  let headerRow = -1
  let nimIdx = -1, namaIdx = -1, prodiIdx = -1
  for (let i = 0; i < Math.min(normalized.length, 12); i++) {
    const headers = normalized[i].map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''))
    const n = headers.findIndex((h) => h === 'nim' || h.includes('nomorindukmahasiswa'))
    const a = headers.findIndex((h) => h === 'nama' || h.includes('namamahasiswa'))
    const p = headers.findIndex((h) => h === 'prodi' || h.includes('programstudi'))
    if (n >= 0 && a >= 0 && p >= 0) { headerRow = i; nimIdx = n; namaIdx = a; prodiIdx = p; break }
  }
  if (headerRow < 0) throw new Error('Kolom NIM, Nama, dan Program Studi tidak ditemukan.')
  return normalized.slice(headerRow + 1).map((r) => ({
    nim: normalizeNim(r[nimIdx]),
    nama: String(r[namaIdx] || '').trim(),
    prodi: normalizeProdi(r[prodiIdx])
  })).filter((x) => x.nim && x.nama && x.prodi)
}

async function parseExcel(file) {
  const XLSX = await loadScript('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js', 'XLSX')
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' })
  return rowsToStudents(rows)
}

async function parsePdf(file) {
  const pdfjsLib = await loadScript('https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js', 'pdfjsLib')
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js'
  const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise
  const lines = []
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p)
    const content = await page.getTextContent()
    const groups = []
    for (const item of content.items) {
      const x = item.transform?.[4] ?? 0
      const y = item.transform?.[5] ?? 0
      let group = groups.find((g) => Math.abs(g.y - y) <= 2)
      if (!group) { group = { y, items: [] }; groups.push(group) }
      group.items.push({ x, text: item.str })
    }
    groups.sort((a, b) => b.y - a.y)
    for (const group of groups) lines.push(group.items.sort((a, b) => a.x - b.x).map((x) => x.text).join(' ').replace(/\s+/g, ' ').trim())
  }
  const students = []
  for (const line of lines) {
    const prodi = normalizeProdi(line)
    if (!prodi) continue
    const tokens = [...line.matchAll(/\b[A-Za-z0-9][A-Za-z0-9._-]{6,19}\b/g)]
      .map((m) => ({ value: m[0], index: m.index ?? -1 }))
      .filter((m) => /\d/.test(m.value))
    if (!tokens.length) continue
    const nimToken = tokens[0]
    const prodiMatch = new RegExp(PRODI.join('|'), 'i').exec(line)
    if (!prodiMatch) continue
    let nama = line.slice(nimToken.index + nimToken.value.length, prodiMatch.index).trim()
      .replace(/^[|;,:\-\s]+|[|;,:\-\s]+$/g, '').replace(/^\d+\s+/, '')
    if (!nama) continue
    students.push({ nim: normalizeNim(nimToken.value), nama, prodi })
  }
  if (!students.length) throw new Error('Tidak menemukan baris mahasiswa pada PDF. Pastikan PDF memiliki teks/tabel, bukan hasil scan gambar.')
  return students
}

function dedupeStudents(rows) {
  const map = new Map()
  for (const row of rows) if (row.nim && row.nama && row.prodi) map.set(row.nim, row)
  return [...map.values()]
}

function renderImportPreview() {
  const rows = extState.importRows
  $('#importValidCount').textContent = rows.length
  $('#importProdiCount').textContent = new Set(rows.map((r) => r.prodi)).size
  $('#executeStudentImport').disabled = rows.length === 0
  $('#studentImportRows').innerHTML = rows.length ? rows.map((r, i) => `<tr class="border-t"><td class="p-4 text-slate-500">${i + 1}</td><td class="p-4 font-black">${escapeHtml(r.nim)}</td><td class="p-4">${escapeHtml(r.nama)}</td><td class="p-4">${escapeHtml(r.prodi)}</td></tr>`).join('') : '<tr><td colspan="4" class="p-8 text-center text-slate-500">Belum ada data.</td></tr>'
}

async function handleStudentFile(event) {
  const file = event.target.files?.[0]
  if (!file) return
  $('#studentImportFileName').textContent = file.name
  setLoading(true, 'Membaca data mahasiswa...')
  try {
    const name = file.name.toLowerCase()
    const rows = name.endsWith('.pdf') ? await parsePdf(file) : await parseExcel(file)
    extState.importRows = dedupeStudents(rows)
    renderImportPreview()
    notify(`${extState.importRows.length} mahasiswa berhasil dideteksi.`)
  } catch (error) {
    extState.importRows = []
    renderImportPreview()
    notify(error.message || 'File tidak dapat dibaca.', 'err')
  } finally {
    setLoading(false)
  }
}

async function executeStudentImport() {
  if (!extState.importRows.length) return
  if (String(extState.profile?.role || '').toLowerCase() !== 'admin') return notify('Hanya admin yang dapat mengimpor mahasiswa.', 'err')
  setLoading(true, `Membuat akun untuk ${extState.importRows.length} mahasiswa...`)
  try {
    const { data, error } = await supabaseClient.functions.invoke('import-mahasiswa', { body: { students: extState.importRows } })
    if (error) throw error
    if (!data?.ok) throw new Error(data?.message || 'Import gagal.')
    const box = $('#studentImportResult')
    box.className = 'mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800'
    box.innerHTML = `<b>Import selesai.</b><br>Dibuat: ${Number(data.created || 0)} akun • Diperbarui: ${Number(data.updated || 0)} • Gagal: ${Number(data.failed || 0)}${data.errors?.length ? `<div class="mt-2 text-xs">${data.errors.slice(0, 8).map((e) => escapeHtml(e)).join('<br>')}</div>` : ''}`
    box.classList.remove('hidden')
    notify('Import mahasiswa selesai.')
  } catch (error) {
    const box = $('#studentImportResult')
    box.className = 'mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700'
    box.textContent = error.message || 'Import mahasiswa gagal.'
    box.classList.remove('hidden')
    notify(error.message || 'Import mahasiswa gagal.', 'err')
  } finally {
    setLoading(false)
  }
}

function downloadTemplate() {
  const text = '\ufeffNIM,Nama,Program Studi\nH011221001,Contoh Mahasiswa,Matematika\n'
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = 'template_import_mahasiswa_SIMASI.csv'
  a.click()
  URL.revokeObjectURL(url)
}

function activeSeminarDocs() {
  return $('input[name="examType"]:checked')?.value === 'Ujian Tutup Skripsi' ? [...BASE_DOCS, ...EXTRA_DOCS] : BASE_DOCS
}

async function uploadDriveFile(file, meta) {
  if (file.size > 10 * 1024 * 1024) throw new Error(`${file.name}: ukuran file melebihi 10 MB.`)
  const form = new FormData()
  form.append('file', file, file.name)
  Object.entries(meta).forEach(([key, value]) => form.append(key, String(value ?? '')))
  const { data, error } = await supabaseClient.functions.invoke('upload-seminar-drive', { body: form })
  if (error) throw error
  if (!data?.ok) throw new Error(data?.message || `Upload ${file.name} ke Google Drive gagal.`)
  return data
}

async function interceptSeminarSubmit(event) {
  if (!hasSupabaseConfiguration) return
  event.preventDefault()
  event.stopImmediatePropagation()
  const submit = $('#submitSeminar')
  if (submit?.disabled) return
  if (!extState.user) return notify('Silakan login terlebih dahulu.', 'info')
  if (extState.profile?.must_change_password) { openPasswordModal(); return notify('Ganti password awal terlebih dahulu.', 'info') }

  const examType = $('input[name="examType"]:checked')?.value
  const prodi = $('#selectedProdi')?.textContent.trim()
  const nim = normalizeNim($('#semNim')?.value)
  const nama = $('#semNama')?.value.trim()
  const regId = crypto.randomUUID()
  const docs = activeSeminarDocs()
  setLoading(true, 'Mengunggah berkas ke Google Drive...')
  try {
    const documentRows = []
    for (let i = 0; i < docs.length; i++) {
      const [key, label] = docs[i]
      const file = $(`.doc-file[data-key="${key}"]`)?.files?.[0]
      const externalUrl = $(`.doc-url[data-key="${key}"]`)?.value.trim() || null
      let row = { jenis_berkas: key, nama_berkas: label, file_url: externalUrl, file_path: null, storage_provider: externalUrl ? 'external_link' : 'google_drive', drive_file_id: null, drive_folder_id: null }
      if (file) {
        setLoading(true, `Upload ${i + 1}/${docs.length}: ${label}`)
        const uploaded = await uploadDriveFile(file, { registration_id: regId, nim, nama, prodi, exam_type: examType, document_key: key, document_label: label })
        row = { ...row, file_url: uploaded.web_view_link || null, file_path: `drive:${uploaded.file_id}`, storage_provider: 'google_drive', drive_file_id: uploaded.file_id, drive_folder_id: uploaded.folder_id || null }
      }
      documentRows.push(row)
    }
    const registration = {
      id: regId,
      user_id: extState.user.id,
      nim,
      nama,
      prodi,
      jenis_ujian: examType,
      pas_foto_jumlah: Number($('#photoCount')?.value || 2),
      status: 'diajukan'
    }
    const reg = await supabaseClient.from('pendaftaran_seminar').insert(registration)
    if (reg.error) throw reg.error
    const rows = documentRows.map((row) => ({ ...row, pendaftaran_id: regId, status: 'terunggah' }))
    const saved = await supabaseClient.from('berkas_seminar').insert(rows)
    if (saved.error) throw saved.error
    notify('Berkas berhasil disimpan ke Google Drive SIMASI dan pendaftaran telah dikirim.')
    $('#seminarForm')?.reset()
  } catch (error) {
    notify(error.message || 'Pendaftaran seminar gagal.', 'err')
  } finally {
    setLoading(false)
  }
}

function bindEnhancements() {
  $('#loginForm')?.addEventListener('submit', interceptLogin, { capture: true })
  $('#initialPasswordForm')?.addEventListener('submit', changeInitialPassword)
  document.addEventListener('click', guardProtectedNavigation, { capture: true })
  $('#adminImportMenu')?.addEventListener('click', () => {
    if (String(extState.profile?.role || '').toLowerCase() !== 'admin') return
    showPageDirect('admin')
  })
  $('#studentImportFile')?.addEventListener('change', handleStudentFile)
  $('#executeStudentImport')?.addEventListener('click', executeStudentImport)
  $('#downloadStudentTemplate')?.addEventListener('click', downloadTemplate)
  $('#seminarForm')?.addEventListener('submit', interceptSeminarSubmit, { capture: true })
}

async function initEnhancements() {
  injectUi()
  bindEnhancements()
  if (!hasSupabaseConfiguration) return
  await refreshAuthState()
  supabaseClient.auth.onAuthStateChange(async () => {
    setTimeout(refreshAuthState, 0)
  })
}

initEnhancements()
