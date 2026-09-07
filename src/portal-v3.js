import { supabaseClient, hasSupabaseConfiguration } from './supabase.js'

const $ = (s) => document.querySelector(s)
const $$ = (s) => [...document.querySelectorAll(s)]
const esc = (value) => String(value ?? '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#039;')

const UNSULBAR_LOGO = 'https://unsulbar.ac.id/uploads/pages/2026/05/img-20260518-11d70975ca6b59a6.png'
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

const portal = {
  user: null,
  profile: null,
  selectedProdi: '',
  importRows: [],
  registrations: [],
  registrationDocs: [],
  users: [],
  postLoginPage: null,
  recoveryMode: false
}

function normalizeNim(value) {
  return String(value ?? '').trim().replace(/\s+/g, '').toUpperCase()
}
function normalizeProdi(value) {
  const s = String(value ?? '').trim().toLowerCase()
  return PRODI.find((p) => s.includes(p.toLowerCase())) || ''
}
function authEmailFromLogin(value) {
  const v = String(value ?? '').trim()
  return v.includes('@') ? v.toLowerCase() : `${normalizeNim(v).toLowerCase()}@students.simasi.local`
}
function role() { return String(portal.profile?.role || '').toLowerCase() }
function isAdmin() { return role() === 'admin' }
function isStudent() { return role() === 'mahasiswa' }
function fmtDate(value) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}
function notify(message, type = 'ok') {
  const toast = $('#toast')
  if (!toast) return
  toast.textContent = message
  toast.className = `fixed bottom-5 right-5 z-[900] max-w-md rounded-2xl px-5 py-4 text-sm font-semibold text-white shadow-2xl ${type === 'err' ? 'bg-rose-600' : type === 'info' ? 'bg-slate-900' : 'bg-emerald-600'}`
  toast.classList.remove('hidden')
  setTimeout(() => toast.classList.add('hidden'), 5200)
}
function setLoading(on, text = 'Memproses...') {
  const loading = $('#loading')
  if (!loading) return
  const box = loading.firstElementChild
  if (box) box.textContent = text
  loading.classList.toggle('hidden', !on)
  loading.classList.toggle('flex', on)
}
async function edge(name, options = {}) {
  const { data, error } = await supabaseClient.functions.invoke(name, options)
  if (error) {
    let message = error.message || `Fungsi ${name} gagal.`
    try {
      const response = error.context
      if (response?.clone) {
        const body = await response.clone().json()
        message = body?.message || body?.error || message
      }
    } catch (_) {}
    throw new Error(message)
  }
  if (data?.ok === false) throw new Error(data.message || `Fungsi ${name} gagal.`)
  return data
}

function injectPortalCss() {
  if ($('#portalV3Css')) return
  const style = document.createElement('style')
  style.id = 'portalV3Css'
  style.textContent = `
    #publicLanding, #publicLogin { min-height:100vh; background:#f8fafc; color:#0f172a; }
    .portal-shell-hidden { display:none !important; }
    .portal-brand-logo { width:52px; height:52px; object-fit:contain; flex:none; }
    .portal-hero { background:linear-gradient(135deg,#0f2747 0%,#14395f 52%,#06624b 100%); }
    .portal-card { background:#fff; border:1px solid #e2e8f0; border-radius:1.25rem; box-shadow:0 8px 30px rgba(15,23,42,.05); }
    .portal-nav-button { width:100%; display:flex; align-items:center; gap:.75rem; padding:.8rem 1rem; border-radius:.85rem; font-size:.875rem; font-weight:700; color:#dbeafe; text-align:left; }
    .portal-nav-button:hover { background:rgba(255,255,255,.08); color:#fff; }
    .portal-nav-button.active { background:rgba(16,185,129,.2); color:#fff; box-shadow:inset 3px 0 0 #34d399; }
    .portal-nav-button.disabled { opacity:.45; cursor:not-allowed; }
    .portal-stat { border:1px solid #e2e8f0; border-radius:1rem; background:#fff; padding:1.15rem; }
    .portal-table th { font-size:.7rem; text-transform:uppercase; letter-spacing:.06em; color:#64748b; font-weight:800; }
    .portal-table td { vertical-align:top; }
    .portal-pill { border-radius:999px; padding:.25rem .65rem; font-size:.68rem; font-weight:800; }
    .portal-empty { padding:2.5rem 1rem; text-align:center; color:#64748b; }
    .prodi-card.portal-selected { border-color:#10b981 !important; background:#ecfdf5 !important; box-shadow:0 0 0 3px rgba(16,185,129,.10); }
    .prodi-card.portal-locked { opacity:.35; cursor:not-allowed; }
    #dbStatus { display:none !important; }
    @media (max-width: 1023px) { #publicLanding .portal-desktop-only { display:none; } }
  `
  document.head.appendChild(style)
}

function replaceBranding() {
  $('#dbStatus')?.classList.add('hidden')
  const brandWrap = $('#sidebar')?.firstElementChild
  if (brandWrap) {
    const oldIcon = brandWrap.querySelector('div:first-child')
    if (oldIcon && !brandWrap.querySelector('img.portal-brand-logo')) {
      const img = document.createElement('img')
      img.src = UNSULBAR_LOGO
      img.alt = 'Logo Universitas Sulawesi Barat'
      img.className = 'portal-brand-logo rounded-xl bg-white p-1'
      oldIcon.replaceWith(img)
    }
    const title = brandWrap.querySelector('h1')
    const sub = brandWrap.querySelector('p')
    if (title) title.textContent = 'SIMASI'
    if (sub) sub.textContent = 'FMIPA • Universitas Sulawesi Barat'
  }
}

function injectLanding() {
  if ($('#publicLanding')) return
  document.body.insertAdjacentHTML('afterbegin', `
    <section id="publicLanding" class="hidden">
      <header class="border-b border-slate-200 bg-white/95 backdrop-blur">
        <div class="mx-auto flex max-w-7xl items-center gap-4 px-5 py-4 lg:px-8">
          <img src="${UNSULBAR_LOGO}" alt="Logo Universitas Sulawesi Barat" class="h-14 w-14 object-contain">
          <div><h1 class="text-xl font-black text-slate-900">SIMASI</h1><p class="text-xs font-semibold text-slate-500">Sistem Informasi Manajemen Kuliah & Skripsi • FMIPA Unsulbar</p></div>
          <button id="landingLoginBtn" class="ml-auto rounded-xl bg-[#0f2747] px-5 py-3 text-sm font-black text-white shadow-sm hover:bg-[#173a64]">Masuk SIMASI</button>
        </div>
      </header>
      <main>
        <section class="portal-hero text-white">
          <div class="mx-auto grid max-w-7xl gap-10 px-5 py-14 lg:grid-cols-[1.15fr_.85fr] lg:px-8 lg:py-20">
            <div class="self-center">
              <span class="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold">FMIPA • UNIVERSITAS SULAWESI BARAT</span>
              <h2 class="mt-6 max-w-3xl text-4xl font-black leading-tight md:text-5xl">Layanan Akademik Seminar dan Tugas Akhir dalam Satu Portal</h2>
              <p class="mt-5 max-w-2xl text-sm leading-7 text-slate-200 md:text-base">Akses informasi akademik, pendaftaran Seminar Proposal/Seminar Hasil, serta layanan administrasi FMIPA secara terintegrasi.</p>
              <div class="mt-7 flex flex-wrap gap-3"><button id="landingSeminarBtn" class="rounded-xl bg-emerald-500 px-5 py-3 text-sm font-black text-white hover:bg-emerald-400">Daftar Seminar</button><button id="landingInfoBtn" class="rounded-xl border border-white/25 bg-white/10 px-5 py-3 text-sm font-black text-white">Lihat Pengumuman</button></div>
            </div>
            <div class="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
              <div class="rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur"><p class="text-xs font-bold uppercase text-emerald-200">Mahasiswa Aktif</p><p id="landingStatStudents" class="mt-2 text-3xl font-black">-</p></div>
              <div class="rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur"><p class="text-xs font-bold uppercase text-emerald-200">Judul Diajukan</p><p id="landingStatTitles" class="mt-2 text-3xl font-black">-</p></div>
              <div class="rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur"><p class="text-xs font-bold uppercase text-emerald-200">Lulus Sidang</p><p id="landingStatGraduated" class="mt-2 text-3xl font-black">-</p></div>
            </div>
          </div>
        </section>
        <section id="landingAnnouncementsSection" class="mx-auto max-w-7xl px-5 py-12 lg:px-8">
          <div class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><p class="text-xs font-black uppercase tracking-[.16em] text-emerald-700">Informasi Terbuka</p><h3 class="mt-2 text-2xl font-black">Informasi & Pengumuman Akademik</h3></div><p class="text-sm text-slate-500">Informasi terbaru FMIPA Unsulbar.</p></div>
          <div id="landingAnnouncements" class="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3"><div class="portal-card p-5 text-sm text-slate-500">Memuat pengumuman...</div></div>
        </section>
        <section class="border-t bg-white"><div class="mx-auto max-w-7xl px-5 py-8 text-center text-xs text-slate-500 lg:px-8">SIMASI • Fakultas Matematika dan Ilmu Pengetahuan Alam • Universitas Sulawesi Barat</div></section>
      </main>
    </section>
    <section id="publicLogin" class="fixed inset-0 z-[700] hidden overflow-y-auto bg-slate-950/55 p-4 backdrop-blur-sm">
      <div class="mx-auto flex min-h-full max-w-5xl items-center justify-center py-8">
        <div class="grid w-full overflow-hidden rounded-3xl bg-white shadow-2xl lg:grid-cols-[.9fr_1.1fr]">
          <div class="portal-hero hidden p-9 text-white lg:block"><img src="${UNSULBAR_LOGO}" class="h-20 w-20 rounded-2xl bg-white p-2 object-contain" alt="Logo Unsulbar"><h2 class="mt-7 text-3xl font-black">SIMASI FMIPA</h2><p class="mt-4 text-sm leading-7 text-slate-200">Masuk menggunakan NIM untuk mahasiswa atau email institusi untuk staf/admin.</p><div class="mt-8 rounded-2xl border border-white/15 bg-white/10 p-5 text-sm leading-6"><b>Mahasiswa baru hasil import</b><br>Username awal: NIM<br>Password awal: NIM<br><span class="text-emerald-200">Wajib diganti pada login pertama.</span></div></div>
          <div class="p-7 md:p-10"><div class="flex items-center justify-between"><div><p class="text-xs font-black uppercase tracking-[.15em] text-emerald-700">Autentikasi SIMASI</p><h2 class="mt-2 text-2xl font-black">Masuk ke Sistem</h2></div><button id="closePublicLogin" class="rounded-xl border px-3 py-2 text-sm font-black">✕</button></div>
            <form id="portalLoginForm" class="mt-7 space-y-4"><div><label class="mb-2 block text-sm font-bold">NIM / Email</label><input id="portalLoginId" required autocomplete="username" class="w-full rounded-xl border border-slate-200 px-4 py-3.5" placeholder="NIM mahasiswa atau email staf/admin"></div><div><label class="mb-2 block text-sm font-bold">Password</label><input id="portalLoginPassword" type="password" required autocomplete="current-password" class="w-full rounded-xl border border-slate-200 px-4 py-3.5" placeholder="Password"></div><button id="portalLoginSubmit" class="w-full rounded-xl bg-emerald-600 px-5 py-3.5 font-black text-white hover:bg-emerald-700">Masuk</button></form>
            <div id="portalLoginError" class="mt-4 hidden rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"></div>
            <button id="portalForgotPassword" class="mt-5 w-full text-center text-xs font-bold text-emerald-700">Lupa password staf/admin?</button>
          </div>
        </div>
      </div>
    </section>`)
}

function injectPasswordModal() {
  if ($('#portalPasswordModal')) return
  document.body.insertAdjacentHTML('beforeend', `
    <div id="portalPasswordModal" class="fixed inset-0 z-[950] hidden items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div class="w-full max-w-lg rounded-3xl bg-white p-7 shadow-2xl"><div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-xl">🔐</div><h2 id="portalPasswordTitle" class="mt-5 text-2xl font-black">Ganti Password Pertama</h2><p id="portalPasswordDesc" class="mt-2 text-sm leading-6 text-slate-500">Buat password baru minimal 8 karakter untuk melanjutkan.</p><form id="portalPasswordForm" class="mt-6 space-y-4"><input id="portalNewPassword" type="password" minlength="8" required autocomplete="new-password" class="w-full rounded-xl border px-4 py-3" placeholder="Password baru (minimal 8 karakter)"><input id="portalNewPasswordConfirm" type="password" minlength="8" required autocomplete="new-password" class="w-full rounded-xl border px-4 py-3" placeholder="Ulangi password baru"><div id="portalPasswordMsg" class="hidden rounded-xl border p-3 text-sm"></div><button class="w-full rounded-xl bg-emerald-600 px-5 py-3 font-black text-white">Simpan Password Baru</button></form></div>
    </div>`)
}

function injectAdminPages() {
  const main = $('main')
  if (!main || $('#page-admin-dashboard')) return
  main.insertAdjacentHTML('beforeend', `
    <section id="page-admin-dashboard" class="page-view">
      <div class="portal-hero rounded-3xl p-7 text-white"><p class="text-xs font-black uppercase tracking-[.16em] text-emerald-200">Administrator SIMASI</p><h1 class="mt-3 text-3xl font-black">Dashboard Admin</h1><p class="mt-2 text-sm text-slate-200">Ringkasan operasional layanan Seminar Proposal/Seminar Hasil FMIPA.</p></div>
      <div class="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><div class="portal-stat"><p class="text-xs font-bold uppercase text-slate-500">Mahasiswa</p><p id="adminStatStudents" class="mt-2 text-3xl font-black">-</p></div><div class="portal-stat"><p class="text-xs font-bold uppercase text-slate-500">Total Pendaftar</p><p id="adminStatRegs" class="mt-2 text-3xl font-black">-</p></div><div class="portal-stat"><p class="text-xs font-bold uppercase text-slate-500">Menunggu Verifikasi</p><p id="adminStatPending" class="mt-2 text-3xl font-black text-amber-600">-</p></div><div class="portal-stat"><p class="text-xs font-bold uppercase text-slate-500">Disetujui</p><p id="adminStatApproved" class="mt-2 text-3xl font-black text-emerald-700">-</p></div></div>
      <div class="mt-6 grid gap-6 xl:grid-cols-[1.25fr_.75fr]"><div class="portal-card overflow-hidden"><div class="flex items-center justify-between border-b p-5"><div><h2 class="font-black">Pendaftaran Terbaru</h2><p class="mt-1 text-xs text-slate-500">Monitoring pendaftar yang baru masuk.</p></div><button id="adminGoRegistrations" class="rounded-xl border px-4 py-2 text-xs font-black">Lihat Semua</button></div><div class="overflow-x-auto"><table class="portal-table min-w-full text-sm"><thead class="bg-slate-50"><tr><th class="p-4 text-left">Mahasiswa</th><th class="p-4 text-left">Jenis</th><th class="p-4 text-left">Status</th><th class="p-4 text-left">Tanggal</th></tr></thead><tbody id="adminRecentRegs"></tbody></table></div></div><div class="portal-card p-5"><h2 class="font-black">Akses Cepat</h2><div class="mt-4 grid gap-3"><button data-admin-shortcut="registrations" class="rounded-xl bg-[#0f2747] px-4 py-3 text-left text-sm font-black text-white">Monitoring Pendaftar</button><button data-admin-shortcut="import" class="rounded-xl border px-4 py-3 text-left text-sm font-black">Import Mahasiswa</button><button data-admin-shortcut="users" class="rounded-xl border px-4 py-3 text-left text-sm font-black">Pengelolaan User</button></div></div></div>
    </section>
    <section id="page-admin-registrations" class="page-view">
      <div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><p class="text-xs font-black uppercase tracking-[.15em] text-emerald-700">Admin SIMASI</p><h1 class="mt-2 text-2xl font-black">Monitoring Pendaftar Seminar</h1><p class="mt-1 text-sm text-slate-500">Pantau pendaftaran, kelengkapan berkas, dan status verifikasi.</p></div><button id="refreshRegistrations" class="rounded-xl border px-4 py-2 text-sm font-black">↻ Refresh</button></div>
      <div class="mt-6 portal-card p-4"><div class="grid gap-3 md:grid-cols-4"><input id="regSearch" class="rounded-xl border px-3 py-2.5 text-sm" placeholder="Cari NIM / nama"><select id="regFilterProdi" class="rounded-xl border px-3 py-2.5 text-sm"><option value="">Semua Prodi</option>${PRODI.map(p=>`<option>${p}</option>`).join('')}</select><select id="regFilterType" class="rounded-xl border px-3 py-2.5 text-sm"><option value="">Semua Jenis</option><option>Seminar Proposal</option><option>Seminar Hasil</option></select><select id="regFilterStatus" class="rounded-xl border px-3 py-2.5 text-sm"><option value="">Semua Status</option><option value="diajukan">Diajukan</option><option value="diverifikasi">Diverifikasi</option><option value="perbaikan">Perbaikan</option><option value="disetujui">Disetujui</option></select></div></div>
      <div class="mt-4 portal-card overflow-hidden"><div class="overflow-x-auto"><table class="portal-table min-w-full text-sm"><thead class="bg-slate-50"><tr><th class="p-4 text-left">Mahasiswa</th><th class="p-4 text-left">Prodi</th><th class="p-4 text-left">Jenis</th><th class="p-4 text-left">Berkas</th><th class="p-4 text-left">Status</th><th class="p-4 text-left">Aksi</th></tr></thead><tbody id="adminRegistrationRows"></tbody></table></div></div>
    </section>
    <section id="page-admin-import" class="page-view">
      <div class="portal-hero rounded-3xl p-7 text-white"><p class="text-xs font-black uppercase tracking-[.15em] text-emerald-200">Administrator SIMASI</p><h1 class="mt-3 text-3xl font-black">Import Data Mahasiswa</h1><p class="mt-2 max-w-3xl text-sm leading-6 text-slate-200">Upload Excel atau PDF berisi NIM, Nama, dan Program Studi. Akun baru memakai NIM sebagai username dan password awal.</p></div>
      <div class="mt-6 grid gap-6 xl:grid-cols-[1.1fr_.9fr]"><div class="portal-card p-6"><div class="flex items-start justify-between gap-4"><div><h2 class="text-xl font-black">1. Pilih File</h2><p class="mt-1 text-sm text-slate-500">Excel .xlsx/.xls/.csv atau PDF berbasis teks.</p></div><button id="downloadStudentTemplate" class="rounded-xl border px-4 py-2 text-xs font-black">Unduh Template CSV</button></div><label class="mt-5 block cursor-pointer rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-8 text-center hover:border-emerald-300 hover:bg-emerald-50"><input id="studentImportFile" type="file" accept=".xlsx,.xls,.csv,.pdf" class="hidden"><div class="text-3xl">⇧</div><p class="mt-3 font-black">Pilih Excel / PDF</p><p id="studentImportFileName" class="mt-1 text-xs text-slate-500">Belum ada file dipilih.</p></label><div class="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800"><b>Kolom dibaca:</b> NIM, Nama, Program Studi. PDF hasil scan gambar tidak diproses otomatis.</div></div><div class="portal-card p-6"><h2 class="text-xl font-black">2. Hasil Deteksi</h2><div class="mt-5 grid grid-cols-3 gap-3 text-center"><div class="rounded-2xl bg-slate-50 p-4"><p class="text-[10px] font-bold uppercase text-slate-500">Baris Valid</p><p id="importValidCount" class="mt-1 text-2xl font-black">0</p></div><div class="rounded-2xl bg-slate-50 p-4"><p class="text-[10px] font-bold uppercase text-slate-500">Prodi</p><p id="importProdiCount" class="mt-1 text-2xl font-black">0</p></div><div class="rounded-2xl bg-slate-50 p-4"><p class="text-[10px] font-bold uppercase text-slate-500">Login Awal</p><p class="mt-1 text-sm font-black text-emerald-700">NIM / NIM</p></div></div><button id="executeStudentImport" disabled class="mt-5 w-full rounded-xl bg-emerald-600 px-5 py-3 font-black text-white disabled:bg-slate-300">Import & Buat Akun Mahasiswa</button><div id="studentImportResult" class="mt-4 hidden rounded-xl border p-4 text-sm"></div></div></div>
      <div class="mt-6 portal-card overflow-hidden"><div class="border-b p-5"><h3 class="font-black">Preview Data</h3><p class="mt-1 text-xs text-slate-500">Data NIM yang sudah ada akan diperbarui tanpa mereset password.</p></div><div class="overflow-x-auto"><table class="portal-table min-w-full text-sm"><thead class="bg-slate-50"><tr><th class="p-4 text-left">No.</th><th class="p-4 text-left">NIM</th><th class="p-4 text-left">Nama</th><th class="p-4 text-left">Program Studi</th></tr></thead><tbody id="studentImportRows"><tr><td colspan="4" class="portal-empty">Belum ada data.</td></tr></tbody></table></div></div>
    </section>
    <section id="page-admin-users" class="page-view">
      <div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><p class="text-xs font-black uppercase tracking-[.15em] text-emerald-700">Admin SIMASI</p><h1 class="mt-2 text-2xl font-black">Pengelolaan User</h1><p class="mt-1 text-sm text-slate-500">Kelola akun mahasiswa, dosen, dan administrator.</p></div><button id="refreshUsers" class="rounded-xl border px-4 py-2 text-sm font-black">↻ Refresh</button></div>
      <div class="mt-6 grid gap-6 xl:grid-cols-[.7fr_1.3fr]"><div class="portal-card p-5"><h2 class="font-black">Tambah Staf</h2><p class="mt-1 text-xs text-slate-500">Akun akan menerima email untuk membuat password sendiri.</p><form id="createStaffForm" class="mt-5 space-y-3"><input id="staffName" required class="w-full rounded-xl border px-3 py-2.5 text-sm" placeholder="Nama lengkap"><input id="staffEmail" type="email" required class="w-full rounded-xl border px-3 py-2.5 text-sm" placeholder="Email"><select id="staffRole" class="w-full rounded-xl border px-3 py-2.5 text-sm"><option value="dosen">Dosen</option><option value="admin">Admin</option></select><button class="w-full rounded-xl bg-[#0f2747] px-4 py-3 text-sm font-black text-white">Buat / Aktifkan Akun</button></form></div><div class="portal-card p-5"><div class="flex items-center justify-between gap-4"><div><h2 class="font-black">Daftar User</h2><p id="userCountLabel" class="mt-1 text-xs text-slate-500">Memuat...</p></div><input id="userSearch" class="max-w-xs rounded-xl border px-3 py-2.5 text-sm" placeholder="Cari nama/NIM/email"></div><div class="mt-4 overflow-x-auto"><table class="portal-table min-w-full text-sm"><thead><tr><th class="py-3 pr-4 text-left">User</th><th class="py-3 pr-4 text-left">Role</th><th class="py-3 pr-4 text-left">Prodi</th><th class="py-3 text-left">Aksi</th></tr></thead><tbody id="adminUserRows"></tbody></table></div></div></div>
    </section>`)

  document.body.insertAdjacentHTML('beforeend', `
    <div id="registrationDetailModal" class="fixed inset-0 z-[850] hidden items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"><div class="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"><div class="flex items-start justify-between"><div><p class="text-xs font-black uppercase text-emerald-700">Detail Pendaftaran</p><h2 id="registrationDetailTitle" class="mt-1 text-xl font-black">-</h2></div><button id="closeRegistrationDetail" class="rounded-xl border px-3 py-2 font-black">✕</button></div><div id="registrationDetailBody" class="mt-5"></div></div></div>`)
}

function renderSidebar() {
  const nav = $('#sidebar nav')
  if (!nav || !portal.user) return
  const future = `<button class="portal-nav-button disabled" data-disabled="true">▤ Manajemen Kuliah <span class="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-[9px]">Segera</span></button><button class="portal-nav-button disabled" data-disabled="true">✎ Logbook Skripsi <span class="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-[9px]">Segera</span></button>`
  if (isAdmin()) {
    nav.innerHTML = `<p class="px-3 py-2 text-[10px] font-bold uppercase tracking-[.2em] text-slate-400">Administrator</p><button class="portal-nav-button" data-portal-page="admin-dashboard">▦ Dashboard Admin</button><button class="portal-nav-button" data-portal-page="admin-registrations">☷ Monitoring Pendaftar</button><button class="portal-nav-button" data-portal-page="admin-import">⇧ Import Data Mahasiswa</button><button class="portal-nav-button" data-portal-page="admin-users">♙ Pengelolaan User</button><div class="my-4 border-t border-white/10"></div>${future}<div class="my-4 border-t border-white/10"></div><button class="portal-nav-button text-rose-200" data-portal-action="logout">← Keluar</button>`
  } else {
    nav.innerHTML = `<p class="px-3 py-2 text-[10px] font-bold uppercase tracking-[.2em] text-slate-400">Menu Utama</p><button class="portal-nav-button" data-portal-page="dashboard">▦ Dashboard</button><button class="portal-nav-button" data-portal-page="seminar">✓ Seminar Proposal/Seminar Hasil</button>${future}<div class="my-4 border-t border-white/10"></div><button class="portal-nav-button text-rose-200" data-portal-action="logout">← Keluar</button>`
  }
  updateAccountUi()
}

function updateAccountUi() {
  const name = portal.profile?.full_name || portal.user?.email || 'Pengguna'
  const r = portal.profile?.role || 'mahasiswa'
  for (const id of ['sideName', 'headName']) if ($(`#${id}`)) $(`#${id}`).textContent = name
  for (const id of ['sideRole', 'headRole']) if ($(`#${id}`)) $(`#${id}`).textContent = r
  for (const id of ['sideAvatar', 'headAvatar']) if ($(`#${id}`)) $(`#${id}`).textContent = name.charAt(0).toUpperCase()
  $('#dbStatus')?.classList.add('hidden')
}

function systemShell(show) {
  const sidebar = $('#sidebar')
  const shell = document.querySelector('body > div.min-h-screen')
  sidebar?.classList.toggle('portal-shell-hidden', !show)
  shell?.classList.toggle('portal-shell-hidden', !show)
}
async function showLanding() {
  systemShell(false)
  $('#publicLanding')?.classList.remove('hidden')
  $('#publicLogin')?.classList.add('hidden')
  await loadLandingData()
}
function showLogin() {
  $('#publicLogin')?.classList.remove('hidden')
  setTimeout(() => $('#portalLoginId')?.focus(), 50)
}
function hideLogin() { $('#publicLogin')?.classList.add('hidden') }

function pageTitle(page) {
  const map = {
    dashboard: ['Dashboard', 'SIMASI'],
    seminar: ['Seminar Proposal/Seminar Hasil', 'Layanan Mahasiswa'],
    'admin-dashboard': ['Dashboard Admin', 'Administrator SIMASI'],
    'admin-registrations': ['Monitoring Pendaftar', 'Administrator SIMASI'],
    'admin-import': ['Import Data Mahasiswa', 'Administrator SIMASI'],
    'admin-users': ['Pengelolaan User', 'Administrator SIMASI']
  }
  return map[page] || ['SIMASI', 'FMIPA Unsulbar']
}
async function showPage(page) {
  if (!portal.user) return showLanding()
  if (page.startsWith('admin-') && !isAdmin()) page = 'dashboard'
  systemShell(true)
  $('#publicLanding')?.classList.add('hidden')
  $$('.page-view').forEach((node) => node.classList.remove('active'))
  const target = $(`#page-${page}`)
  if (target) target.classList.add('active')
  const [title, eye] = pageTitle(page)
  if ($('#pageTitle')) $('#pageTitle').textContent = title
  if ($('#eyebrow')) $('#eyebrow').textContent = eye
  $$('[data-portal-page]').forEach((node) => node.classList.toggle('active', node.dataset.portalPage === page))
  $('#sidebar')?.classList.add('-translate-x-full')
  $('#overlay')?.classList.add('hidden')
  window.scrollTo({ top: 0, behavior: 'smooth' })
  if (page === 'dashboard') renderStudentDashboard()
  if (page === 'seminar') prepareSeminarPage()
  if (page === 'admin-dashboard') await loadAdminDashboard()
  if (page === 'admin-registrations') await loadRegistrations()
  if (page === 'admin-users') await loadUsers()
}

async function loadLandingData() {
  if (!hasSupabaseConfiguration) return
  const [stats, announcements] = await Promise.all([
    supabaseClient.rpc('get_dashboard_stats'),
    supabaseClient.from('pengumuman').select('id,judul,isi,tanggal').eq('is_active', true).order('tanggal', { ascending: false }).limit(6)
  ])
  const s = Array.isArray(stats.data) ? stats.data[0] : stats.data
  if ($('#landingStatStudents')) $('#landingStatStudents').textContent = s?.mahasiswa_aktif ?? 0
  if ($('#landingStatTitles')) $('#landingStatTitles').textContent = s?.judul_diajukan ?? 0
  if ($('#landingStatGraduated')) $('#landingStatGraduated').textContent = s?.lulus_sidang ?? 0
  const rows = announcements.data || []
  if ($('#landingAnnouncements')) $('#landingAnnouncements').innerHTML = rows.length ? rows.map(a => `<article class="portal-card p-5"><p class="text-xs font-black uppercase text-emerald-700">${esc(fmtDate(a.tanggal))}</p><h4 class="mt-2 font-black">${esc(a.judul)}</h4><p class="mt-2 text-sm leading-6 text-slate-500">${esc(a.isi)}</p></article>`).join('') : '<div class="portal-card p-5 text-sm text-slate-500">Belum ada pengumuman aktif.</div>'
}

function renderStudentDashboard() {
  const page = $('#page-dashboard')
  if (!page || !portal.profile) return
  const name = portal.profile.full_name || 'Mahasiswa'
  const prodi = portal.profile.prodi || '-'
  const nim = portal.profile.nim || '-'
  page.innerHTML = `<div class="portal-hero rounded-3xl p-7 text-white"><p class="text-xs font-black uppercase tracking-[.15em] text-emerald-200">Dashboard Mahasiswa</p><h1 class="mt-3 text-3xl font-black">Selamat Datang, ${esc(name)}</h1><p class="mt-2 text-sm text-slate-200">Kelola proses Seminar Proposal/Seminar Hasil melalui akun pribadi Anda.</p></div><div class="mt-6 grid gap-4 md:grid-cols-3"><div class="portal-stat"><p class="text-xs font-bold uppercase text-slate-500">NIM</p><p class="mt-2 text-xl font-black">${esc(nim)}</p></div><div class="portal-stat"><p class="text-xs font-bold uppercase text-slate-500">Program Studi</p><p class="mt-2 text-xl font-black">${esc(prodi)}</p></div><div class="portal-stat"><p class="text-xs font-bold uppercase text-slate-500">Status Akun</p><p class="mt-2 text-xl font-black text-emerald-700">Aktif</p></div></div><div class="mt-6 portal-card p-6"><h2 class="text-xl font-black">Layanan Aktif</h2><p class="mt-2 text-sm text-slate-500">Tahap pengembangan saat ini difokuskan pada pendaftaran seminar.</p><button data-portal-page="seminar" class="mt-5 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white">Buka Seminar Proposal/Seminar Hasil</button></div>`
}

function renderPdfDocs() {
  const docs = $('#docs')
  if (!docs) return
  $('#extraDocs')?.classList.add('hidden')
  docs.innerHTML = DOCS.map(([key, label], i) => `<div class="doc-row rounded-2xl border bg-white p-4" data-key="${key}"><div class="flex flex-col gap-3 lg:flex-row lg:items-center"><div class="flex min-w-0 flex-1 items-start gap-3"><span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-xs font-black text-emerald-700">${i + 1}</span><div><b class="text-sm">${esc(label)}</b><p class="mt-1 text-[11px] text-slate-500">PDF • maksimal 2 MB</p></div></div><div class="flex flex-col gap-2 sm:flex-row lg:w-[46%]"><label class="flex-1 cursor-pointer rounded-xl border border-dashed bg-slate-50 px-3 py-3 text-center text-xs font-bold hover:border-emerald-300 hover:bg-emerald-50"><input class="portal-doc-file hidden" data-key="${key}" type="file" accept="application/pdf,.pdf"><span class="file-name">Pilih PDF</span></label><button type="button" data-remove-doc="${key}" class="hidden rounded-xl border border-rose-100 px-3 py-2 text-xs font-bold text-rose-600">Hapus</button><span class="doc-badge self-center rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500">Belum Diisi</span></div></div></div>`).join('')
  $$('.portal-doc-file').forEach(input => input.addEventListener('change', handlePdfSelection))
  $$('[data-remove-doc]').forEach(btn => btn.addEventListener('click', removePdfSelection))
  validateSeminar()
}
function chooseProdi(prodi) {
  if (!PRODI.includes(prodi)) return
  if (isStudent() && portal.profile?.prodi && portal.profile.prodi !== prodi) {
    notify(`Program studi akun Anda adalah ${portal.profile.prodi}. Hubungi admin jika data ini tidak sesuai.`, 'info')
    return
  }
  portal.selectedProdi = prodi
  $$('.prodi-card').forEach(card => card.classList.toggle('portal-selected', card.dataset.prodi === prodi))
  if ($('#selectedProdi')) $('#selectedProdi').textContent = prodi
  $('#seminarForm')?.classList.remove('hidden')
  if (!$('#docs .portal-doc-file')) renderPdfDocs()
  fillStudentIdentity()
  setTimeout(() => $('#seminarForm')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
}
function prepareSeminarPage() {
  const title = $('#page-seminar h1')
  if (title) title.textContent = 'Seminar Proposal/Seminar Hasil'
  const intro = $('#page-seminar h1')?.nextElementSibling
  if (intro) intro.textContent = 'Lengkapi persyaratan dan unggah seluruh berkas dalam format PDF maksimal 2 MB per file.'
  const radios = $$('input[name="examType"]')
  if (radios[0]) { radios[0].value = 'Seminar Proposal'; const b=radios[0].closest('label')?.querySelector('b'); if(b)b.textContent='Seminar Proposal' }
  if (radios[1]) { radios[1].value = 'Seminar Hasil'; const b=radios[1].closest('label')?.querySelector('b'); if(b)b.textContent='Seminar Hasil' }
  if (!$('#docs .portal-doc-file')) renderPdfDocs()
  $$('.prodi-card').forEach(card => {
    const p = card.dataset.prodi
    card.classList.toggle('portal-locked', Boolean(isStudent() && portal.profile?.prodi && portal.profile.prodi !== p))
  })
  if (isStudent() && portal.profile?.prodi) chooseProdi(portal.profile.prodi)
  fillStudentIdentity()
}
function fillStudentIdentity() {
  if (!isStudent()) return validateSeminar()
  if ($('#semNim')) { $('#semNim').value = portal.profile?.nim || ''; $('#semNim').readOnly = true }
  if ($('#semNama')) { $('#semNama').value = portal.profile?.full_name || ''; $('#semNama').readOnly = true }
  const change = $('#changeProdi')
  if (change) change.classList.add('hidden')
  validateSeminar()
}
function handlePdfSelection(event) {
  const input = event.currentTarget, file = input.files?.[0], row = input.closest('.doc-row')
  if (!file) return validateSeminar()
  if (!file.name.toLowerCase().endsWith('.pdf') || (file.type && file.type !== 'application/pdf')) { input.value=''; notify('Format berkas harus PDF.', 'err'); return validateSeminar() }
  if (file.size > MAX_PDF_BYTES) { input.value=''; notify(`${file.name}: ukuran maksimal 2 MB.`, 'err'); return validateSeminar() }
  row.querySelector('.file-name').textContent = file.name
  const badge = row.querySelector('.doc-badge'); badge.textContent='Siap Diunggah'; badge.className='doc-badge self-center rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700'
  row.querySelector('[data-remove-doc]')?.classList.remove('hidden'); row.classList.add('complete'); validateSeminar()
}
function removePdfSelection(event) {
  const key = event.currentTarget.dataset.removeDoc, input = $(`.portal-doc-file[data-key="${key}"]`), row = event.currentTarget.closest('.doc-row')
  if (input) input.value=''
  row.querySelector('.file-name').textContent='Pilih PDF'; const badge=row.querySelector('.doc-badge'); badge.textContent='Belum Diisi'; badge.className='doc-badge self-center rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500'; event.currentTarget.classList.add('hidden'); row.classList.remove('complete'); validateSeminar()
}
function validateSeminar() {
  const submit=$('#submitSeminar'); if(!submit)return
  const files=DOCS.map(([key])=>$(`.portal-doc-file[data-key="${key}"]`)?.files?.[0]).filter(Boolean)
  const exam=$('input[name="examType"]:checked')?.value, nim=normalizeNim($('#semNim')?.value), nama=$('#semNama')?.value.trim(), prodi=portal.selectedProdi
  const okFiles=files.length===DOCS.length&&files.every(f=>f.size<=MAX_PDF_BYTES&&f.name.toLowerCase().endsWith('.pdf'))
  const allowed=Boolean(portal.user&&!portal.profile?.must_change_password)
  submit.disabled=!(PRODI.includes(prodi)&&['Seminar Proposal','Seminar Hasil'].includes(exam)&&nim&&nama&&okFiles&&allowed)
  if($('#docProgress'))$('#docProgress').textContent=`${files.length} / ${DOCS.length}`
  if($('#semMessage'))$('#semMessage').textContent=!prodi?'Pilih program studi.':!exam?'Pilih jenis seminar.':!allowed?'Ganti password awal terlebih dahulu.':files.length<DOCS.length?`${DOCS.length-files.length} berkas PDF belum dilengkapi.`:'Semua berkas lengkap dan siap dikirim.'
}
async function uploadDriveFile(file, meta) {
  const form = new FormData(); form.append('file', file, file.name); Object.entries(meta).forEach(([k,v])=>form.append(k,String(v??'')))
  return edge('upload-seminar-drive', { body: form })
}
async function submitSeminar(event) {
  event.preventDefault(); event.stopImmediatePropagation(); validateSeminar()
  if ($('#submitSeminar')?.disabled) return
  const examType=$('input[name="examType"]:checked')?.value, prodi=portal.selectedProdi, nim=normalizeNim($('#semNim')?.value), nama=$('#semNama')?.value.trim(), regId=crypto.randomUUID()
  setLoading(true,'Menyiapkan pendaftaran...')
  try {
    const reg=await supabaseClient.from('pendaftaran_seminar').insert({id:regId,user_id:portal.user.id,nim,nama,prodi,jenis_ujian:examType,pas_foto_jumlah:2,status:'diajukan'})
    if(reg.error)throw reg.error
    for(let i=0;i<DOCS.length;i++){
      const [key,label]=DOCS[i], file=$(`.portal-doc-file[data-key="${key}"]`)?.files?.[0]
      if(!file)throw new Error(`${label} belum dipilih.`)
      setLoading(true,`Upload ${i+1}/${DOCS.length}: ${label}`)
      const up=await uploadDriveFile(file,{registration_id:regId,nim,nama,prodi,exam_type:examType,document_key:key,document_label:label})
      const saved=await supabaseClient.from('berkas_seminar').insert({pendaftaran_id:regId,jenis_berkas:key,nama_berkas:label,file_url:up.web_view_link||null,file_path:`drive:${up.file_id}`,status:'terunggah',storage_provider:'google_drive',drive_file_id:up.file_id,drive_folder_id:up.folder_id||null})
      if(saved.error)throw saved.error
    }
    notify('Pendaftaran dan seluruh berkas berhasil dikirim.')
    $('#seminarForm')?.reset(); portal.selectedProdi=''; renderPdfDocs(); if(isStudent()&&portal.profile?.prodi)chooseProdi(portal.profile.prodi)
  } catch(error) {
    const message=error.message||'Pendaftaran seminar gagal.'
    notify(message,'err')
    try { await supabaseClient.from('pendaftaran_seminar').update({status:'gagal_upload',catatan_verifikator:message.slice(0,500)}).eq('id',regId) } catch(_){}
  } finally { setLoading(false); validateSeminar() }
}

async function loadRegistrations() {
  if (!isAdmin()) return
  setLoading(true,'Memuat pendaftar...')
  try {
    const [regs, docs] = await Promise.all([
      supabaseClient.from('pendaftaran_seminar').select('*').order('created_at',{ascending:false}),
      supabaseClient.from('berkas_seminar').select('id,pendaftaran_id,jenis_berkas,nama_berkas,file_url,status,created_at').order('created_at',{ascending:true})
    ])
    if(regs.error)throw regs.error; if(docs.error)throw docs.error
    portal.registrations=regs.data||[]; portal.registrationDocs=docs.data||[]
    renderRegistrations(); renderAdminStats()
  } catch(e){notify(e.message||'Gagal memuat pendaftar.','err')} finally {setLoading(false)}
}
function filteredRegistrations(){
  const q=String($('#regSearch')?.value||'').toLowerCase(), prodi=$('#regFilterProdi')?.value||'', type=$('#regFilterType')?.value||'', status=$('#regFilterStatus')?.value||''
  return portal.registrations.filter(r=>(!q||`${r.nim} ${r.nama}`.toLowerCase().includes(q))&&(!prodi||r.prodi===prodi)&&(!type||r.jenis_ujian===type)&&(!status||r.status===status))
}
function statusBadge(status){ const map={diajukan:'bg-amber-50 text-amber-700',diverifikasi:'bg-blue-50 text-blue-700',perbaikan:'bg-rose-50 text-rose-700',disetujui:'bg-emerald-50 text-emerald-700',gagal_upload:'bg-rose-50 text-rose-700'}; return `<span class="portal-pill ${map[status]||'bg-slate-100 text-slate-600'}">${esc(status||'-')}</span>` }
function renderRegistrations(){
  const tbody=$('#adminRegistrationRows'); if(!tbody)return
  const rows=filteredRegistrations(); tbody.innerHTML=rows.length?rows.map(r=>{const count=portal.registrationDocs.filter(d=>d.pendaftaran_id===r.id).length;return `<tr class="border-t"><td class="p-4"><b>${esc(r.nama)}</b><div class="mt-1 text-xs text-slate-500">${esc(r.nim)} • ${fmtDate(r.created_at)}</div></td><td class="p-4">${esc(r.prodi)}</td><td class="p-4">${esc(r.jenis_ujian)}</td><td class="p-4"><b>${count}</b> / ${DOCS.length}</td><td class="p-4">${statusBadge(r.status)}</td><td class="p-4"><div class="flex flex-wrap gap-2"><button data-reg-detail="${r.id}" class="rounded-lg border px-3 py-2 text-xs font-black">Detail</button><select data-reg-status="${r.id}" class="rounded-lg border px-2 py-2 text-xs"><option value="diajukan" ${r.status==='diajukan'?'selected':''}>Diajukan</option><option value="diverifikasi" ${r.status==='diverifikasi'?'selected':''}>Diverifikasi</option><option value="perbaikan" ${r.status==='perbaikan'?'selected':''}>Perbaikan</option><option value="disetujui" ${r.status==='disetujui'?'selected':''}>Disetujui</option></select></div></td></tr>`}).join(''):'<tr><td colspan="6" class="portal-empty">Belum ada pendaftar.</td></tr>'
  $$('[data-reg-detail]').forEach(b=>b.onclick=()=>openRegistrationDetail(b.dataset.regDetail))
  $$('[data-reg-status]').forEach(s=>s.onchange=()=>updateRegistrationStatus(s.dataset.regStatus,s.value))
}
async function updateRegistrationStatus(id,status){ const r=await supabaseClient.from('pendaftaran_seminar').update({status}).eq('id',id); if(r.error)return notify(r.error.message,'err'); const row=portal.registrations.find(x=>x.id===id); if(row)row.status=status; notify('Status pendaftaran diperbarui.'); renderRegistrations(); renderAdminStats() }
function openRegistrationDetail(id){
  const r=portal.registrations.find(x=>x.id===id); if(!r)return
  const docs=portal.registrationDocs.filter(d=>d.pendaftaran_id===id)
  $('#registrationDetailTitle').textContent=`${r.nama} • ${r.nim}`
  $('#registrationDetailBody').innerHTML=`<div class="grid gap-3 sm:grid-cols-3"><div class="rounded-xl bg-slate-50 p-3"><p class="text-xs text-slate-500">Prodi</p><b>${esc(r.prodi)}</b></div><div class="rounded-xl bg-slate-50 p-3"><p class="text-xs text-slate-500">Jenis</p><b>${esc(r.jenis_ujian)}</b></div><div class="rounded-xl bg-slate-50 p-3"><p class="text-xs text-slate-500">Status</p>${statusBadge(r.status)}</div></div><h3 class="mt-6 font-black">Berkas (${docs.length}/${DOCS.length})</h3><div class="mt-3 grid gap-2">${docs.length?docs.map(d=>`<div class="flex items-center justify-between rounded-xl border p-3"><div><b class="text-sm">${esc(d.nama_berkas)}</b><p class="text-xs text-slate-500">${esc(d.jenis_berkas)}</p></div>${d.file_url?`<a target="_blank" rel="noopener" href="${esc(d.file_url)}" class="rounded-lg bg-[#0f2747] px-3 py-2 text-xs font-black text-white">Buka File</a>`:'<span class="text-xs text-slate-400">Tidak ada link</span>'}</div>`).join(''):'<div class="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">Belum ada berkas tersimpan.</div>'}</div>`
  const modal=$('#registrationDetailModal'); modal.classList.remove('hidden'); modal.classList.add('flex')
}
function renderAdminStats(){
  const regs=portal.registrations
  if($('#adminStatRegs'))$('#adminStatRegs').textContent=regs.length
  if($('#adminStatPending'))$('#adminStatPending').textContent=regs.filter(r=>['diajukan','gagal_upload'].includes(r.status)).length
  if($('#adminStatApproved'))$('#adminStatApproved').textContent=regs.filter(r=>r.status==='disetujui').length
  const recent=$('#adminRecentRegs'); if(recent)recent.innerHTML=regs.slice(0,6).map(r=>`<tr class="border-t"><td class="p-4"><b>${esc(r.nama)}</b><div class="text-xs text-slate-500">${esc(r.nim)} • ${esc(r.prodi)}</div></td><td class="p-4">${esc(r.jenis_ujian)}</td><td class="p-4">${statusBadge(r.status)}</td><td class="p-4 text-xs text-slate-500">${fmtDate(r.created_at)}</td></tr>`).join('')||'<tr><td colspan="4" class="portal-empty">Belum ada pendaftaran.</td></tr>'
}
async function loadAdminDashboard(){
  if(!isAdmin())return
  setLoading(true,'Memuat dashboard admin...')
  try{
    const [studentCount,regs,docs]=await Promise.all([supabaseClient.from('mahasiswa').select('id',{count:'exact',head:true}),supabaseClient.from('pendaftaran_seminar').select('*').order('created_at',{ascending:false}),supabaseClient.from('berkas_seminar').select('id,pendaftaran_id,jenis_berkas,nama_berkas,file_url,status,created_at')])
    if(regs.error)throw regs.error; portal.registrations=regs.data||[]; portal.registrationDocs=docs.data||[]; if($('#adminStatStudents'))$('#adminStatStudents').textContent=studentCount.count??0; renderAdminStats()
  }catch(e){notify(e.message||'Dashboard admin gagal dimuat.','err')}finally{setLoading(false)}
}

async function loadUsers(){
  if(!isAdmin())return
  setLoading(true,'Memuat user...')
  try{const data=await edge('admin-users',{body:{action:'list'}});portal.users=data.users||[];renderUsers()}catch(e){notify(e.message||'Gagal memuat user.','err')}finally{setLoading(false)}
}
function renderUsers(){
  const q=String($('#userSearch')?.value||'').toLowerCase(); const rows=portal.users.filter(u=>!q||`${u.full_name||''} ${u.email||''} ${u.nim||''}`.toLowerCase().includes(q)); if($('#userCountLabel'))$('#userCountLabel').textContent=`${rows.length} user ditampilkan`
  const tbody=$('#adminUserRows'); if(!tbody)return
  tbody.innerHTML=rows.length?rows.map(u=>`<tr class="border-t"><td class="py-3 pr-4"><b>${esc(u.full_name||'-')}</b><div class="text-xs text-slate-500">${esc(u.nim||u.email||'-')}</div></td><td class="py-3 pr-4"><select data-user-role="${u.id}" ${u.id===portal.user?.id?'disabled':''} class="rounded-lg border px-2 py-2 text-xs"><option value="mahasiswa" ${u.role==='mahasiswa'?'selected':''}>Mahasiswa</option><option value="dosen" ${u.role==='dosen'?'selected':''}>Dosen</option><option value="admin" ${u.role==='admin'?'selected':''}>Admin</option></select></td><td class="py-3 pr-4 text-sm">${esc(u.prodi||'-')}</td><td class="py-3"><button data-user-reset="${u.id}" data-user-email="${esc(u.email||'')}" ${!u.email?'disabled':''} class="rounded-lg border px-3 py-2 text-xs font-black disabled:opacity-40">Reset Password</button></td></tr>`).join(''):'<tr><td colspan="4" class="portal-empty">User tidak ditemukan.</td></tr>'
  $$('[data-user-role]').forEach(s=>s.onchange=()=>setUserRole(s.dataset.userRole,s.value))
  $$('[data-user-reset]').forEach(b=>b.onclick=()=>resetUserPassword(b.dataset.userEmail))
}
async function setUserRole(userId,newRole){try{await edge('admin-users',{body:{action:'set_role',user_id:userId,role:newRole}});notify('Role user diperbarui.');await loadUsers()}catch(e){notify(e.message,'err')}}
async function resetUserPassword(email){if(!email)return;try{await edge('admin-users',{body:{action:'reset_password',email}});notify('Email reset password telah dikirim.','info')}catch(e){notify(e.message,'err')}}
async function createStaff(event){event.preventDefault();setLoading(true,'Membuat akun staf...');try{await edge('admin-users',{body:{action:'create_staff',full_name:$('#staffName').value.trim(),email:$('#staffEmail').value.trim(),role:$('#staffRole').value}});$('#createStaffForm').reset();notify('Akun staf siap. Email pengaturan password telah dikirim.');await loadUsers()}catch(e){notify(e.message,'err')}finally{setLoading(false)}}

function loadScript(src,globalName){if(window[globalName])return Promise.resolve(window[globalName]);return new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=src;script.async=true;script.onload=()=>resolve(window[globalName]);script.onerror=()=>reject(new Error(`Gagal memuat ${globalName}.`));document.head.appendChild(script)})}
function rowsToStudents(rows){const n=rows.map(r=>Array.isArray(r)?r.map(v=>String(v??'').trim()):[]);let h=-1,ni=-1,na=-1,pi=-1;for(let i=0;i<Math.min(n.length,15);i++){const a=n[i].map(x=>x.toLowerCase().replace(/[^a-z0-9]/g,''));const x=a.findIndex(v=>v==='nim'||v.includes('nomorindukmahasiswa')),y=a.findIndex(v=>v==='nama'||v.includes('namamahasiswa')),z=a.findIndex(v=>v==='prodi'||v.includes('programstudi'));if(x>=0&&y>=0&&z>=0){h=i;ni=x;na=y;pi=z;break}}if(h<0)throw new Error('Kolom NIM, Nama, dan Program Studi tidak ditemukan.');return n.slice(h+1).map(r=>({nim:normalizeNim(r[ni]),nama:String(r[na]||'').trim(),prodi:normalizeProdi(r[pi])})).filter(x=>x.nim&&x.nama&&x.prodi)}
async function parseExcel(file){const XLSX=await loadScript('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js','XLSX');const wb=XLSX.read(await file.arrayBuffer(),{type:'array'}),sheet=wb.Sheets[wb.SheetNames[0]];return rowsToStudents(XLSX.utils.sheet_to_json(sheet,{header:1,raw:false,defval:''}))}
async function parsePdf(file){const pdfjsLib=await loadScript('https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js','pdfjsLib');pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';const pdf=await pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise, lines=[];for(let p=1;p<=pdf.numPages;p++){const page=await pdf.getPage(p),content=await page.getTextContent(),groups=[];for(const item of content.items){const x=item.transform?.[4]??0,y=item.transform?.[5]??0;let g=groups.find(v=>Math.abs(v.y-y)<=2);if(!g){g={y,items:[]};groups.push(g)}g.items.push({x,text:item.str})}groups.sort((a,b)=>b.y-a.y);for(const g of groups)lines.push(g.items.sort((a,b)=>a.x-b.x).map(x=>x.text).join(' ').replace(/\s+/g,' ').trim())}const students=[];for(const line of lines){const prodi=normalizeProdi(line);if(!prodi)continue;const tokens=[...line.matchAll(/\b[A-Za-z0-9][A-Za-z0-9._-]{6,19}\b/g)].map(m=>({value:m[0],index:m.index??-1})).filter(m=>/\d{5,}/.test(m.value));if(!tokens.length)continue;const t=tokens[0],pm=new RegExp(PRODI.join('|'),'i').exec(line);if(!pm)continue;const nama=line.slice(t.index+t.value.length,pm.index).trim().replace(/^[|;,:\-\s]+|[|;,:\-\s]+$/g,'').replace(/^\d+\s+/,'');if(nama)students.push({nim:normalizeNim(t.value),nama,prodi})}if(!students.length)throw new Error('Tidak menemukan data mahasiswa. Pastikan PDF berbasis teks, bukan scan gambar.');return students}
function renderImportPreview(){const rows=portal.importRows;if($('#importValidCount'))$('#importValidCount').textContent=rows.length;if($('#importProdiCount'))$('#importProdiCount').textContent=new Set(rows.map(r=>r.prodi)).size;if($('#executeStudentImport'))$('#executeStudentImport').disabled=!rows.length;if($('#studentImportRows'))$('#studentImportRows').innerHTML=rows.length?rows.map((r,i)=>`<tr class="border-t"><td class="p-4 text-slate-500">${i+1}</td><td class="p-4 font-black">${esc(r.nim)}</td><td class="p-4">${esc(r.nama)}</td><td class="p-4">${esc(r.prodi)}</td></tr>`).join(''):'<tr><td colspan="4" class="portal-empty">Belum ada data.</td></tr>'}
async function handleStudentFile(event){const file=event.target.files?.[0];if(!file)return;$('#studentImportFileName').textContent=file.name;setLoading(true,'Membaca data mahasiswa...');try{const rows=file.name.toLowerCase().endsWith('.pdf')?await parsePdf(file):await parseExcel(file);const map=new Map();rows.forEach(r=>map.set(r.nim,r));portal.importRows=[...map.values()];renderImportPreview();notify(`${portal.importRows.length} mahasiswa berhasil dideteksi.`)}catch(e){portal.importRows=[];renderImportPreview();notify(e.message,'err')}finally{setLoading(false)}}
async function executeStudentImport(){if(!portal.importRows.length)return;setLoading(true,`Mengimpor ${portal.importRows.length} mahasiswa...`);try{const data=await edge('import-mahasiswa',{body:{students:portal.importRows}});const box=$('#studentImportResult');box.className='mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800';box.innerHTML=`<b>Import selesai.</b><br>Dibuat: ${Number(data.created||0)} • Diperbarui: ${Number(data.updated||0)} • Gagal: ${Number(data.failed||0)}${data.errors?.length?`<div class="mt-2 text-xs">${data.errors.slice(0,10).map(esc).join('<br>')}</div>`:''}`;box.classList.remove('hidden');notify('Import mahasiswa selesai.');await loadUsers()}catch(e){const box=$('#studentImportResult');if(box){box.className='mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700';box.innerHTML=`<b>Import gagal.</b><br>${esc(e.message)}`;box.classList.remove('hidden')}notify(e.message,'err')}finally{setLoading(false)}}
function downloadTemplate(){const text='\ufeffNIM,Nama,Program Studi\nH011221001,Contoh Mahasiswa,Matematika\n',url=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='template_import_mahasiswa_SIMASI.csv';a.click();URL.revokeObjectURL(url)}

function openPasswordModal(recovery=false){portal.recoveryMode=recovery;const modal=$('#portalPasswordModal');$('#portalPasswordTitle').textContent=recovery?'Atur Password Baru':'Ganti Password Pertama';$('#portalPasswordDesc').textContent=recovery?'Tautan pemulihan telah diverifikasi. Buat password baru minimal 8 karakter.':'Password awal hanya untuk login pertama. Buat password baru minimal 8 karakter untuk melanjutkan.';modal.classList.remove('hidden');modal.classList.add('flex')}
async function changePassword(event){event.preventDefault();const password=$('#portalNewPassword').value,confirm=$('#portalNewPasswordConfirm').value,msg=$('#portalPasswordMsg');const setMsg=(t,err=true)=>{msg.textContent=t;msg.className=`rounded-xl border p-3 text-sm ${err?'border-rose-200 bg-rose-50 text-rose-700':'border-emerald-200 bg-emerald-50 text-emerald-700'}`;msg.classList.remove('hidden')};if(password.length<8)return setMsg('Password minimal 8 karakter.');if(password!==confirm)return setMsg('Konfirmasi password tidak sama.');if(portal.profile?.nim&&password.toUpperCase()===String(portal.profile.nim).toUpperCase())return setMsg('Password baru tidak boleh sama dengan NIM.');setLoading(true,'Mengganti password...');try{if(portal.recoveryMode){const r=await supabaseClient.auth.updateUser({password});if(r.error)throw r.error}else await edge('change-initial-password',{body:{new_password:password}});if(portal.profile)portal.profile.must_change_password=false;setMsg('Password berhasil diperbarui.',false);$('#portalPasswordForm').reset();setTimeout(()=>{$('#portalPasswordModal').classList.add('hidden');$('#portalPasswordModal').classList.remove('flex');portal.recoveryMode=false},350);notify('Password baru aktif.')}catch(e){setMsg(e.message||'Gagal mengganti password.')}finally{setLoading(false)}}

async function login(event){event.preventDefault();const id=$('#portalLoginId').value.trim(),password=$('#portalLoginPassword').value,btn=$('#portalLoginSubmit'),box=$('#portalLoginError');btn.disabled=true;btn.textContent='Memverifikasi...';try{const r=await supabaseClient.auth.signInWithPassword({email:authEmailFromLogin(id),password});if(r.error)throw r.error;hideLogin();await refreshAuth();notify('Login berhasil.');await showPage(isAdmin()?'admin-dashboard':(portal.postLoginPage||'dashboard'));portal.postLoginPage=null;if(portal.profile?.must_change_password)openPasswordModal(false)}catch(e){box.textContent=e.message||'Login gagal.';box.classList.remove('hidden')}finally{btn.disabled=false;btn.textContent='Masuk'}}
async function forgotPassword(){const id=$('#portalLoginId').value.trim();if(!id.includes('@'))return notify('Masukkan email staf/admin terlebih dahulu.','info');setLoading(true,'Mengirim email pemulihan...');try{const r=await supabaseClient.auth.resetPasswordForEmail(id.toLowerCase(),{redirectTo:window.location.origin});if(r.error)throw r.error;notify('Email pemulihan telah dikirim.','info')}catch(e){notify(e.message,'err')}finally{setLoading(false)}}
async function logout(){await supabaseClient.auth.signOut();portal.user=null;portal.profile=null;portal.selectedProdi='';renderSidebar();await showLanding()}

async function refreshAuth(){
  if(!hasSupabaseConfiguration)return
  const s=await supabaseClient.auth.getSession();portal.user=s.data.session?.user||null;portal.profile=null
  if(portal.user){const p=await supabaseClient.from('profiles').select('*').eq('id',portal.user.id).maybeSingle();portal.profile=p.data||null}
  if(portal.user){systemShell(true);$('#publicLanding')?.classList.add('hidden');renderSidebar();updateAccountUi();if(portal.profile?.must_change_password)setTimeout(()=>openPasswordModal(false),50)}else await showLanding()
}

function bindEvents(){
  $('#landingLoginBtn')?.addEventListener('click',showLogin);$('#landingSeminarBtn')?.addEventListener('click',()=>{portal.postLoginPage='seminar';showLogin()});$('#landingInfoBtn')?.addEventListener('click',()=>$('#landingAnnouncementsSection')?.scrollIntoView({behavior:'smooth'}));$('#closePublicLogin')?.addEventListener('click',hideLogin);$('#portalLoginForm')?.addEventListener('submit',login);$('#portalForgotPassword')?.addEventListener('click',forgotPassword);$('#portalPasswordForm')?.addEventListener('submit',changePassword)
  document.addEventListener('click',(event)=>{
    const disabled=event.target.closest?.('[data-disabled="true"]');if(disabled){event.preventDefault();event.stopImmediatePropagation();return notify('Fitur ini akan diaktifkan pada tahap berikutnya.','info')}
    const p=event.target.closest?.('[data-portal-page]');if(p){event.preventDefault();event.stopImmediatePropagation();showPage(p.dataset.portalPage);return}
    const a=event.target.closest?.('[data-portal-action="logout"]');if(a){event.preventDefault();event.stopImmediatePropagation();logout();return}
    const prodi=event.target.closest?.('[data-prodi]');if(prodi&&portal.user){event.preventDefault();event.stopImmediatePropagation();chooseProdi(prodi.dataset.prodi);return}
    const oldNav=event.target.closest?.('[data-page]');if(oldNav&&portal.user){const page=oldNav.dataset.page;if(['dashboard','seminar'].includes(page)){event.preventDefault();event.stopImmediatePropagation();showPage(page)}}
  },{capture:true})
  $('#seminarForm')?.addEventListener('submit',submitSeminar,{capture:true});$$('input[name="examType"]').forEach(r=>r.addEventListener('change',validateSeminar));$('#semNim')?.addEventListener('input',validateSeminar);$('#semNama')?.addEventListener('input',validateSeminar)
  $('#refreshRegistrations')?.addEventListener('click',loadRegistrations);['regSearch','regFilterProdi','regFilterType','regFilterStatus'].forEach(id=>$(`#${id}`)?.addEventListener(id==='regSearch'?'input':'change',renderRegistrations));$('#closeRegistrationDetail')?.addEventListener('click',()=>{$('#registrationDetailModal').classList.add('hidden');$('#registrationDetailModal').classList.remove('flex')});$('#registrationDetailModal')?.addEventListener('click',e=>{if(e.target.id==='registrationDetailModal'){$('#registrationDetailModal').classList.add('hidden');$('#registrationDetailModal').classList.remove('flex')}})
  $('#adminGoRegistrations')?.addEventListener('click',()=>showPage('admin-registrations'));$$('[data-admin-shortcut]').forEach(b=>b.addEventListener('click',()=>showPage(`admin-${b.dataset.adminShortcut}`)))
  $('#studentImportFile')?.addEventListener('change',handleStudentFile);$('#executeStudentImport')?.addEventListener('click',executeStudentImport);$('#downloadStudentTemplate')?.addEventListener('click',downloadTemplate);$('#refreshUsers')?.addEventListener('click',loadUsers);$('#userSearch')?.addEventListener('input',renderUsers);$('#createStaffForm')?.addEventListener('submit',createStaff)
}

async function initPortal(){
  injectPortalCss();replaceBranding();injectLanding();injectPasswordModal();injectAdminPages();bindEvents();$('#dbStatus')?.remove();if(!hasSupabaseConfiguration){systemShell(false);$('#publicLanding')?.classList.remove('hidden');return}
  await refreshAuth()
  supabaseClient.auth.onAuthStateChange((event)=>{if(event==='PASSWORD_RECOVERY')setTimeout(()=>openPasswordModal(true),50);setTimeout(refreshAuth,80)})
  if(portal.user)await showPage(isAdmin()?'admin-dashboard':'dashboard')
}

initPortal()
