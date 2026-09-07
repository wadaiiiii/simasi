import { supabaseClient, hasSupabaseConfiguration } from './supabase.js'

const $ = (s) => document.querySelector(s)
const $$ = (s) => [...document.querySelectorAll(s)]
const esc = (value) => String(value ?? '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#039;')

const PRODI = ['Matematika', 'Statistika', 'Aktuaria', 'Bioteknologi']
const DOCS = [
  ['persetujuan_ta', 'Halaman Persetujuan Tugas Akhir'],
  ['krs', 'Kartu Rencana Studi Semester Terakhir'],
  ['khs', 'Kartu Hasil Studi Semester Terakhir'],
  ['transkrip', 'Transkrip Nilai Terakhir'],
  ['ijazah', 'Fotocopy Ijazah SMA'],
  ['ktp', 'Fotocopy KTP'],
  ['kontrol_pembimbing', 'Kartu Kontrol Pembimbing'],
  ['kontrol_seminar', 'Kartu Kontrol Mengikuti Seminar'],
  ['sk_kegiatan', 'SK Kegiatan'],
  ['pas_foto', 'Pas Foto 3x4 (2 lembar dalam satu PDF)']
]
const MAX_PDF_BYTES = 2 * 1024 * 1024
const extState = { user: null, profile: null, importRows: [], postLoginPage: null, recoveryMode: false }

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
function isAdmin() { return String(extState.profile?.role || '').toLowerCase() === 'admin' }
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
    seminar: ['Seminar Proposal/Seminar Hasil', 'Layanan Mahasiswa'],
    login: ['Login', 'Autentikasi'],
    admin: ['Import Data Mahasiswa', 'Admin SIMASI']
  }
  if (titles[page]) {
    $('#pageTitle').textContent = titles[page][0]
    $('#eyebrow').textContent = titles[page][1]
  }
  $('#sidebar')?.classList.add('-translate-x-full')
  $('#overlay')?.classList.add('hidden')
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function disableFutureMenus() {
  const configs = [
    ['kuliah', '▤ Manajemen Kuliah'],
    ['logbook', '✎ Logbook Skripsi'],
    ['laporan', '▥ Laporan & Nilai']
  ]
  for (const [page, label] of configs) {
    $$(`[data-page="${page}"]`).forEach((button) => {
      button.classList.add('simasi-disabled-menu')
      button.innerHTML = `<span class="flex-1 text-left">${label}</span><span class="rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-bold">Segera</span>`
    })
  }
}

function injectAdminUi() {
  const nav = $('#sidebar nav')
  if (nav && !$('#adminImportMenu')) {
    const divider = [...nav.children].find((n) => n.classList?.contains('my-5'))
    const button = document.createElement('button')
    button.id = 'adminImportMenu'
    button.type = 'button'
    button.className = 'hidden w-full gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-slate-100 hover:bg-white/10'
    button.innerHTML = '⇧ Import Data Mahasiswa'
    if (divider) nav.insertBefore(button, divider)
    else nav.appendChild(button)
  }

  const main = $('main')
  if (main && !$('#page-admin')) {
    main.insertAdjacentHTML('beforeend', `
      <section id="page-admin" class="page-view">
        <div class="simasi-soft-hero rounded-3xl p-7 text-white">
          <p class="text-xs font-bold uppercase tracking-[.18em] text-white/70">Administrator SIMASI</p>
          <h1 class="mt-3 text-3xl font-black">Import Data Mahasiswa</h1>
          <p class="mt-2 max-w-3xl text-sm leading-6 text-white/80">Upload Excel atau PDF yang hanya memuat NIM, Nama, dan Program Studi. Akun mahasiswa baru otomatis dibuat dengan username NIM dan password awal NIM.</p>
        </div>
        <div class="mt-6 grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
          <div class="rounded-3xl border bg-white p-6 shadow-sm">
            <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div><h2 class="text-xl font-black">1. Pilih File</h2><p class="mt-1 text-sm text-slate-500">Excel: .xlsx/.xls/.csv • PDF harus berbasis teks, bukan scan gambar.</p></div>
              <button id="downloadStudentTemplate" type="button" class="rounded-xl border px-4 py-2 text-xs font-black">Unduh Template CSV</button>
            </div>
            <label class="mt-5 block cursor-pointer rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-8 text-center hover:border-violet-300 hover:bg-violet-50/40">
              <input id="studentImportFile" type="file" accept=".xlsx,.xls,.csv,.pdf" class="hidden">
              <div class="text-3xl">⇧</div><p class="mt-3 font-black">Pilih Excel / PDF</p><p id="studentImportFileName" class="mt-1 text-xs text-slate-500">Belum ada file dipilih.</p>
            </label>
            <div class="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-800"><b>Kolom yang dibaca:</b> NIM, Nama, Program Studi. PDF hasil scan gambar tidak diproses otomatis.</div>
          </div>
          <div class="rounded-3xl border bg-white p-6 shadow-sm">
            <h2 class="text-xl font-black">2. Hasil Deteksi</h2>
            <div class="mt-5 grid grid-cols-3 gap-3 text-center"><div class="rounded-2xl bg-slate-50 p-4"><p class="text-[10px] font-bold uppercase text-slate-500">Baris Valid</p><p id="importValidCount" class="mt-1 text-2xl font-black">0</p></div><div class="rounded-2xl bg-slate-50 p-4"><p class="text-[10px] font-bold uppercase text-slate-500">Prodi</p><p id="importProdiCount" class="mt-1 text-2xl font-black">0</p></div><div class="rounded-2xl bg-slate-50 p-4"><p class="text-[10px] font-bold uppercase text-slate-500">Login Awal</p><p class="mt-1 text-sm font-black text-violet-700">NIM / NIM</p></div></div>
            <button id="executeStudentImport" type="button" disabled class="mt-5 w-full rounded-xl bg-violet-600 px-5 py-3 font-black text-white disabled:bg-slate-300">Import & Buat Akun Mahasiswa</button>
            <div id="studentImportResult" class="mt-4 hidden rounded-xl border p-4 text-sm"></div>
          </div>
        </div>
        <div class="mt-6 overflow-hidden rounded-3xl border bg-white shadow-sm"><div class="border-b p-5"><h3 class="font-black">Preview Data</h3><p class="mt-1 text-xs text-slate-500">Periksa data sebelum import. Data duplikat NIM akan diperbarui, bukan dibuat ulang.</p></div><div class="overflow-x-auto"><table class="min-w-full text-sm"><thead class="bg-slate-50"><tr><th class="p-4 text-left">No.</th><th class="p-4 text-left">NIM</th><th class="p-4 text-left">Nama</th><th class="p-4 text-left">Program Studi</th></tr></thead><tbody id="studentImportRows"><tr><td colspan="4" class="p-8 text-center text-slate-500">Belum ada data.</td></tr></tbody></table></div></div>
      </section>`)
  }
}

function injectPasswordUi() {
  if (!$('#initialPasswordModal')) {
    document.body.insertAdjacentHTML('beforeend', `
      <div id="initialPasswordModal" class="fixed inset-0 z-[500] hidden items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
        <div class="w-full max-w-lg rounded-3xl bg-white p-7 shadow-2xl">
          <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-xl">🔐</div>
          <h2 id="passwordModalTitle" class="mt-5 text-2xl font-black">Ganti Password Pertama</h2>
          <p id="passwordModalDesc" class="mt-2 text-sm leading-6 text-slate-500">Password awal hanya untuk login pertama. Buat password baru minimal 8 karakter untuk melanjutkan.</p>
          <form id="initialPasswordForm" class="mt-6 space-y-4">
            <input id="initialNewPassword" type="password" minlength="8" required autocomplete="new-password" class="w-full rounded-xl border px-4 py-3" placeholder="Password baru (minimal 8 karakter)">
            <input id="initialNewPasswordConfirm" type="password" minlength="8" required autocomplete="new-password" class="w-full rounded-xl border px-4 py-3" placeholder="Ulangi password baru">
            <div id="initialPasswordMessage" class="hidden rounded-xl border p-3 text-sm"></div>
            <button class="w-full rounded-xl bg-violet-600 px-5 py-3 font-black text-white">Simpan Password Baru</button>
          </form>
        </div>
      </div>`)
  }
}

function injectLoginUi() {
  const input = $('#email')
  if (input) {
    input.type = 'text'
    input.placeholder = 'NIM mahasiswa atau email staf/admin'
    input.autocomplete = 'username'
  }
  const heading = $('#page-login h2')
  if (heading) heading.textContent = 'Masuk ke SIMASI'
  const form = $('#loginForm')
  if (form && !$('#nimLoginHelp')) {
    form.insertAdjacentHTML('beforebegin', '<div id="nimLoginHelp" class="mt-5 rounded-2xl border border-violet-100 bg-violet-50 p-4 text-xs leading-5 text-violet-900"><b>Mahasiswa:</b> gunakan NIM sebagai username. Pada akun hasil import, password awal juga NIM dan wajib diganti setelah login pertama.</div>')
    form.insertAdjacentHTML('afterend', '<button id="forgotStaffPassword" type="button" class="mt-4 w-full text-center text-xs font-bold text-violet-700">Lupa password staf/admin?</button>')
  }
}

function renderPdfDocs() {
  const docs = $('#docs')
  const extra = $('#extraDocs')
  if (!docs) return
  if (extra) { extra.innerHTML = ''; extra.classList.add('hidden') }
  docs.innerHTML = DOCS.map(([key, label], index) => `
    <div class="doc-row rounded-2xl border bg-white p-4" data-key="${key}">
      <div class="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div class="flex min-w-0 flex-1 items-start gap-3">
          <span class="doc-index flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-xs font-black text-violet-700">${index + 1}</span>
          <div class="min-w-0"><b class="text-sm">${esc(label)}</b><p class="mt-1 text-[11px] text-slate-500">PDF • maksimal 2 MB</p></div>
        </div>
        <div class="flex flex-col gap-2 sm:flex-row lg:w-[46%]">
          <label class="flex-1 cursor-pointer rounded-xl border border-dashed bg-slate-50 px-3 py-3 text-center text-xs font-bold hover:border-violet-300 hover:bg-violet-50/40"><input class="doc-file hidden" data-key="${key}" type="file" accept="application/pdf,.pdf"><span class="file-name">Pilih PDF</span></label>
          <button type="button" data-remove-doc="${key}" class="hidden rounded-xl border border-rose-100 px-3 py-2 text-xs font-bold text-rose-600">Hapus</button>
          <span class="doc-badge self-center rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500">Belum Diisi</span>
        </div>
      </div>
    </div>`).join('')
  $$('.doc-file').forEach((input) => input.addEventListener('change', handlePdfSelection))
  $$('[data-remove-doc]').forEach((button) => button.addEventListener('click', removePdfSelection))
  validatePdfSeminar()
}

function configureSeminarUi() {
  const title = $('#page-seminar h1')
  if (title) title.textContent = 'Seminar Proposal/Seminar Hasil'
  const menu = $('[data-page="seminar"]')
  if (menu) menu.textContent = '✓ Seminar Proposal/Seminar Hasil'
  const subtitle = $('#page-seminar .simasi-seminar-copy')
  if (subtitle) subtitle.textContent = 'Login terlebih dahulu, pilih program studi, lalu unggah 10 berkas wajib dalam format PDF maksimal 2 MB per file.'

  const radios = $$('input[name="examType"]')
  if (radios[0]) radios[0].value = 'Seminar Proposal'
  if (radios[1]) {
    radios[1].value = 'Seminar Hasil'
    const label = radios[1].closest('label')?.querySelector('b')
    if (label) label.textContent = 'Seminar Hasil'
  }
  const firstLabel = radios[0]?.closest('label')?.querySelector('b')
  if (firstLabel) firstLabel.textContent = 'Seminar Proposal'
  if ($('#photoCount')) $('#photoCount').value = '2'

  renderPdfDocs()
  $$('[data-prodi]').forEach((card) => card.addEventListener('click', () => setTimeout(() => {
    renderPdfDocs()
    fillStudentIdentity()
  }, 0)))
  radios.forEach((radio) => radio.addEventListener('change', () => setTimeout(validatePdfSeminar, 0)))
  $('#semNim')?.addEventListener('input', validatePdfSeminar)
  $('#semNama')?.addEventListener('input', validatePdfSeminar)
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
  const menu = $('#adminImportMenu')
  if (menu) {
    menu.classList.toggle('hidden', !isAdmin())
    menu.classList.toggle('flex', isAdmin())
  }
  fillStudentIdentity()
  if (extState.profile?.must_change_password) openPasswordModal(false)
}

function fillStudentIdentity() {
  const nim = $('#semNim')
  const nama = $('#semNama')
  if (!nim || !nama || !extState.profile) return
  if (String(extState.profile.role || '').toLowerCase() === 'mahasiswa') {
    nim.value = extState.profile.nim || ''
    nama.value = extState.profile.full_name || ''
    nim.readOnly = true
    nama.readOnly = true
    const prodi = extState.profile.prodi
    if (prodi && PRODI.includes(prodi)) {
      const card = $(`[data-prodi="${prodi}"]`)
      if (card) {
        $$('.prodi-card').forEach((x) => x.classList.remove('selected'))
        card.classList.add('selected')
        $('#selectedProdi').textContent = prodi
        $('#seminarForm')?.classList.remove('hidden')
      }
    }
  }
  validatePdfSeminar()
}

function openPasswordModal(recovery = false) {
  extState.recoveryMode = recovery
  const modal = $('#initialPasswordModal')
  if (!modal) return
  $('#passwordModalTitle').textContent = recovery ? 'Atur Password Baru' : 'Ganti Password Pertama'
  $('#passwordModalDesc').textContent = recovery
    ? 'Tautan pemulihan berhasil diverifikasi. Buat password baru minimal 8 karakter.'
    : 'Password awal hanya untuk login pertama. Buat password baru minimal 8 karakter untuk melanjutkan.'
  modal.classList.remove('hidden')
  modal.classList.add('flex')
}
function closePasswordModal() {
  const modal = $('#initialPasswordModal')
  if (!modal) return
  modal.classList.add('hidden')
  modal.classList.remove('flex')
  extState.recoveryMode = false
}

async function interceptLogin(event) {
  event.preventDefault()
  event.stopImmediatePropagation()
  if (!hasSupabaseConfiguration) return notify('Supabase belum dikonfigurasi pada Vercel.', 'err')
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
    $('#loginMsg')?.classList.add('hidden')
    const target = extState.postLoginPage || (isAdmin() ? 'admin' : 'dashboard')
    extState.postLoginPage = null
    showPageDirect(target)
    if (extState.profile?.must_change_password) {
      notify('Login berhasil. Ganti password awal untuk melanjutkan.', 'info')
      openPasswordModal(false)
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

async function requestStaffPasswordReset() {
  if (!hasSupabaseConfiguration) return
  const identifier = $('#email')?.value.trim() || ''
  if (!identifier.includes('@')) return notify('Masukkan email staf/admin pada kolom login terlebih dahulu.', 'info')
  setLoading(true, 'Mengirim email pemulihan...')
  try {
    const { error } = await supabaseClient.auth.resetPasswordForEmail(identifier.toLowerCase(), { redirectTo: window.location.origin })
    if (error) throw error
    notify('Email pemulihan password telah dikirim. Periksa inbox/spam.', 'info')
  } catch (error) {
    notify(error.message || 'Email pemulihan gagal dikirim.', 'err')
  } finally { setLoading(false) }
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
    notify('Password baru aktif.')
  } catch (error) {
    setMsg(error.message || 'Gagal mengganti password.')
  } finally { setLoading(false) }
}

function interceptNavigation(event) {
  const disabled = event.target.closest?.('.simasi-disabled-menu')
  if (disabled) {
    event.preventDefault(); event.stopImmediatePropagation()
    notify('Fitur ini sementara dinonaktifkan. Fokus tahap ini adalah Seminar Proposal/Seminar Hasil.', 'info')
    return
  }
  const seminar = event.target.closest?.('[data-page="seminar"]')
  if (seminar && hasSupabaseConfiguration) {
    if (!extState.user) {
      event.preventDefault(); event.stopImmediatePropagation()
      extState.postLoginPage = 'seminar'
      showPageDirect('login')
      notify('Login terlebih dahulu untuk membuka pendaftaran seminar.', 'info')
      return
    }
    if (extState.profile?.must_change_password) {
      event.preventDefault(); event.stopImmediatePropagation()
      openPasswordModal(false)
      notify('Ganti password awal sebelum mengakses pendaftaran seminar.', 'info')
    }
  }
}

function loadScript(src, globalName) {
  if (window[globalName]) return Promise.resolve(window[globalName])
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = src; script.async = true; script.dataset.simasiLib = globalName
    script.onload = () => resolve(window[globalName]); script.onerror = () => reject(new Error(`Gagal memuat ${globalName}.`))
    document.head.appendChild(script)
  })
}
function rowsToStudents(rows) {
  const normalized = rows.map((r) => Array.isArray(r) ? r.map((v) => String(v ?? '').trim()) : [])
  let headerRow = -1, nimIdx = -1, namaIdx = -1, prodiIdx = -1
  for (let i = 0; i < Math.min(normalized.length, 15); i++) {
    const headers = normalized[i].map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''))
    const n = headers.findIndex((h) => h === 'nim' || h.includes('nomorindukmahasiswa'))
    const a = headers.findIndex((h) => h === 'nama' || h.includes('namamahasiswa'))
    const p = headers.findIndex((h) => h === 'prodi' || h.includes('programstudi'))
    if (n >= 0 && a >= 0 && p >= 0) { headerRow = i; nimIdx = n; namaIdx = a; prodiIdx = p; break }
  }
  if (headerRow < 0) throw new Error('Kolom NIM, Nama, dan Program Studi tidak ditemukan.')
  return normalized.slice(headerRow + 1).map((r) => ({ nim: normalizeNim(r[nimIdx]), nama: String(r[namaIdx] || '').trim(), prodi: normalizeProdi(r[prodiIdx]) })).filter((x) => x.nim && x.nama && x.prodi)
}
async function parseExcel(file) {
  const XLSX = await loadScript('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js', 'XLSX')
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  return rowsToStudents(XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' }))
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
      const x = item.transform?.[4] ?? 0, y = item.transform?.[5] ?? 0
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
    const tokens = [...line.matchAll(/\b[A-Za-z0-9][A-Za-z0-9._-]{6,19}\b/g)].map((m) => ({ value: m[0], index: m.index ?? -1 })).filter((m) => /\d{5,}/.test(m.value))
    if (!tokens.length) continue
    const nimToken = tokens[0]
    const prodiMatch = new RegExp(PRODI.join('|'), 'i').exec(line)
    if (!prodiMatch) continue
    const nama = line.slice(nimToken.index + nimToken.value.length, prodiMatch.index).trim().replace(/^[|;,:\-\s]+|[|;,:\-\s]+$/g, '').replace(/^\d+\s+/, '')
    if (nama) students.push({ nim: normalizeNim(nimToken.value), nama, prodi })
  }
  if (!students.length) throw new Error('Tidak menemukan baris mahasiswa. Pastikan PDF memiliki teks/tabel, bukan scan gambar.')
  return students
}
function dedupeStudents(rows) {
  const map = new Map(); for (const row of rows) if (row.nim && row.nama && row.prodi) map.set(row.nim, row); return [...map.values()]
}
function renderImportPreview() {
  const rows = extState.importRows
  $('#importValidCount').textContent = rows.length
  $('#importProdiCount').textContent = new Set(rows.map((r) => r.prodi)).size
  $('#executeStudentImport').disabled = rows.length === 0
  $('#studentImportRows').innerHTML = rows.length ? rows.map((r, i) => `<tr class="border-t"><td class="p-4 text-slate-500">${i + 1}</td><td class="p-4 font-black">${esc(r.nim)}</td><td class="p-4">${esc(r.nama)}</td><td class="p-4">${esc(r.prodi)}</td></tr>`).join('') : '<tr><td colspan="4" class="p-8 text-center text-slate-500">Belum ada data.</td></tr>'
}
async function handleStudentFile(event) {
  const file = event.target.files?.[0]; if (!file) return
  $('#studentImportFileName').textContent = file.name
  setLoading(true, 'Membaca data mahasiswa...')
  try {
    extState.importRows = dedupeStudents(file.name.toLowerCase().endsWith('.pdf') ? await parsePdf(file) : await parseExcel(file))
    renderImportPreview(); notify(`${extState.importRows.length} mahasiswa berhasil dideteksi.`)
  } catch (error) { extState.importRows = []; renderImportPreview(); notify(error.message || 'File tidak dapat dibaca.', 'err') }
  finally { setLoading(false) }
}
async function executeStudentImport() {
  if (!extState.importRows.length) return
  if (!isAdmin()) return notify('Hanya admin yang dapat mengimpor mahasiswa.', 'err')
  setLoading(true, `Mengimpor ${extState.importRows.length} mahasiswa...`)
  try {
    const { data, error } = await supabaseClient.functions.invoke('import-mahasiswa', { body: { students: extState.importRows } })
    if (error) throw error
    if (!data?.ok) throw new Error(data?.message || 'Import gagal.')
    const box = $('#studentImportResult')
    box.className = 'mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800'
    box.innerHTML = `<b>Import selesai.</b><br>Dibuat: ${Number(data.created || 0)} • Diperbarui: ${Number(data.updated || 0)} • Gagal: ${Number(data.failed || 0)}${data.errors?.length ? `<div class="mt-2 text-xs">${data.errors.slice(0, 8).map(esc).join('<br>')}</div>` : ''}`
    box.classList.remove('hidden'); notify('Import mahasiswa selesai.')
  } catch (error) { notify(error.message || 'Import mahasiswa gagal.', 'err') }
  finally { setLoading(false) }
}
function downloadTemplate() {
  const text = '\ufeffNIM,Nama,Program Studi\nH011221001,Contoh Mahasiswa,Matematika\n'
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a'); a.href = url; a.download = 'template_import_mahasiswa_SIMASI.csv'; a.click(); URL.revokeObjectURL(url)
}

function handlePdfSelection(event) {
  const input = event.currentTarget
  const file = input.files?.[0]
  const row = input.closest('.doc-row')
  const badge = row?.querySelector('.doc-badge')
  const name = row?.querySelector('.file-name')
  const remove = row?.querySelector('[data-remove-doc]')
  if (!file) return validatePdfSeminar()
  if (!file.name.toLowerCase().endsWith('.pdf') || (file.type && file.type !== 'application/pdf')) {
    input.value = ''; notify('Format berkas harus PDF.', 'err'); return validatePdfSeminar()
  }
  if (file.size > MAX_PDF_BYTES) {
    input.value = ''; notify(`${file.name}: ukuran maksimal 2 MB.`, 'err'); return validatePdfSeminar()
  }
  if (name) name.textContent = file.name
  if (badge) { badge.textContent = 'Siap Diunggah'; badge.className = 'doc-badge self-center rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700' }
  remove?.classList.remove('hidden')
  row?.classList.add('complete')
  validatePdfSeminar()
}
function removePdfSelection(event) {
  const key = event.currentTarget.dataset.removeDoc
  const input = $(`.doc-file[data-key="${key}"]`)
  if (input) input.value = ''
  const row = event.currentTarget.closest('.doc-row')
  const badge = row?.querySelector('.doc-badge'), name = row?.querySelector('.file-name')
  if (name) name.textContent = 'Pilih PDF'
  if (badge) { badge.textContent = 'Belum Diisi'; badge.className = 'doc-badge self-center rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500' }
  event.currentTarget.classList.add('hidden'); row?.classList.remove('complete'); validatePdfSeminar()
}
function selectedProdi() { return $('#selectedProdi')?.textContent.trim() || '' }
function validatePdfSeminar() {
  const submit = $('#submitSeminar'); if (!submit) return
  const files = DOCS.map(([key]) => $(`.doc-file[data-key="${key}"]`)?.files?.[0]).filter(Boolean)
  const exam = $('input[name="examType"]:checked')?.value
  const nim = normalizeNim($('#semNim')?.value), nama = $('#semNama')?.value.trim(), prodi = selectedProdi()
  const validFiles = files.length === DOCS.length && files.every((f) => f.size <= MAX_PDF_BYTES && f.name.toLowerCase().endsWith('.pdf'))
  const allowed = Boolean(extState.user && !extState.profile?.must_change_password)
  submit.disabled = !(PRODI.includes(prodi) && ['Seminar Proposal', 'Seminar Hasil'].includes(exam) && nim && nama && validFiles && allowed)
  if ($('#docProgress')) $('#docProgress').textContent = `${files.length} / ${DOCS.length}`
  if ($('#semMessage')) $('#semMessage').textContent = !allowed ? 'Login dan ganti password awal terlebih dahulu.' : files.length < DOCS.length ? `${DOCS.length - files.length} berkas PDF belum dilengkapi.` : 'Semua berkas lengkap dan siap dikirim.'
}
async function uploadDriveFile(file, meta) {
  if (file.size > MAX_PDF_BYTES) throw new Error(`${file.name}: ukuran file melebihi 2 MB.`)
  if (!file.name.toLowerCase().endsWith('.pdf')) throw new Error(`${file.name}: format harus PDF.`)
  const form = new FormData(); form.append('file', file, file.name); Object.entries(meta).forEach(([key, value]) => form.append(key, String(value ?? '')))
  const { data, error } = await supabaseClient.functions.invoke('upload-seminar-drive', { body: form })
  if (error) throw error
  if (!data?.ok) throw new Error(data?.message || `Upload ${file.name} gagal.`)
  return data
}
async function interceptSeminarSubmit(event) {
  if (!hasSupabaseConfiguration) return
  event.preventDefault(); event.stopImmediatePropagation(); validatePdfSeminar()
  const submit = $('#submitSeminar'); if (submit?.disabled) return
  if (!extState.user) return notify('Silakan login terlebih dahulu.', 'info')
  if (extState.profile?.must_change_password) { openPasswordModal(false); return }
  const examType = $('input[name="examType"]:checked')?.value
  const prodi = selectedProdi(), nim = normalizeNim($('#semNim')?.value), nama = $('#semNama')?.value.trim()
  const regId = crypto.randomUUID()
  setLoading(true, 'Menyiapkan pendaftaran...')
  try {
    const registration = { id: regId, user_id: extState.user.id, nim, nama, prodi, jenis_ujian: examType, pas_foto_jumlah: 2, status: 'diajukan' }
    const reg = await supabaseClient.from('pendaftaran_seminar').insert(registration)
    if (reg.error) throw reg.error
    for (let i = 0; i < DOCS.length; i++) {
      const [key, label] = DOCS[i]
      const file = $(`.doc-file[data-key="${key}"]`)?.files?.[0]
      if (!file) throw new Error(`${label} belum dipilih.`)
      setLoading(true, `Upload ${i + 1}/${DOCS.length}: ${label}`)
      const uploaded = await uploadDriveFile(file, { registration_id: regId, nim, nama, prodi, exam_type: examType, document_key: key, document_label: label })
      const saved = await supabaseClient.from('berkas_seminar').insert({ pendaftaran_id: regId, jenis_berkas: key, nama_berkas: label, file_url: uploaded.web_view_link || null, file_path: `drive:${uploaded.file_id}`, status: 'terunggah', storage_provider: 'google_drive', drive_file_id: uploaded.file_id, drive_folder_id: uploaded.folder_id || null })
      if (saved.error) throw saved.error
    }
    notify('Pendaftaran dan 10 berkas PDF berhasil dikirim ke Google Drive SIMASI.')
    $('#seminarForm')?.reset(); renderPdfDocs(); fillStudentIdentity()
  } catch (error) { notify(error.message || 'Pendaftaran seminar gagal.', 'err') }
  finally { setLoading(false); validatePdfSeminar() }
}

function bindEnhancements() {
  $('#loginForm')?.addEventListener('submit', interceptLogin, { capture: true })
  $('#forgotStaffPassword')?.addEventListener('click', requestStaffPasswordReset)
  $('#initialPasswordForm')?.addEventListener('submit', changeInitialPassword)
  document.addEventListener('click', interceptNavigation, { capture: true })
  $('#adminImportMenu')?.addEventListener('click', () => { if (isAdmin()) showPageDirect('admin') })
  $('#studentImportFile')?.addEventListener('change', handleStudentFile)
  $('#executeStudentImport')?.addEventListener('click', executeStudentImport)
  $('#downloadStudentTemplate')?.addEventListener('click', downloadTemplate)
  $('#seminarForm')?.addEventListener('submit', interceptSeminarSubmit, { capture: true })
}

async function initEnhancements() {
  disableFutureMenus(); injectAdminUi(); injectPasswordUi(); injectLoginUi(); configureSeminarUi(); bindEnhancements()
  if (!hasSupabaseConfiguration) return
  await refreshAuthState()
  supabaseClient.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') setTimeout(() => openPasswordModal(true), 0)
    setTimeout(refreshAuthState, 0)
  })
}

initEnhancements()
