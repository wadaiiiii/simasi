import { logo, PRODI, DOCS, state, isAdmin, isStaff, isLecturer, esc, normalizeProdi } from '../v4/core.js'
export { importHtml, usersHtml } from '../v4/views.js'

function passwordModal(){
  return `<div id="passwordModal" class="fixed inset-0 z-[950] hidden items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"><div class="w-full max-w-lg rounded-3xl bg-white p-7 shadow-2xl"><div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-xl">🔐</div><h2 id="passwordTitle" class="mt-5 text-2xl font-extrabold">Ganti Password Pertama</h2><p id="passwordDesc" class="mt-2 text-sm leading-6 text-slate-500">Buat password baru minimal 8 karakter.</p><form id="passwordForm" class="mt-6 space-y-4"><input id="newPassword" type="password" minlength="8" required autocomplete="new-password" class="w-full rounded-xl border px-4 py-3" placeholder="Password baru"><input id="newPassword2" type="password" minlength="8" required autocomplete="new-password" class="w-full rounded-xl border px-4 py-3" placeholder="Ulangi password"><div id="passwordMsg" class="hidden rounded-xl border p-3 text-sm"></div><button class="w-full rounded-xl bg-emerald-600 px-5 py-3 font-extrabold text-white">Simpan Password Baru</button></form></div></div>`
}

function adminNav(){
  return `<p class="px-3 py-2 text-[10px] font-bold uppercase tracking-[.2em] text-slate-400">Administrator</p>
    <button data-page="admin-dashboard" class="simasi-nav">▦ Dashboard Admin</button>
    <button data-page="admin-registrations" class="simasi-nav">☷ Monitoring Pendaftar</button>
    <button data-page="admin-announcements" class="simasi-nav">◉ Informasi Akademik</button>
    <button data-page="admin-import" class="simasi-nav">⇧ Import Data Mahasiswa</button>
    <button data-page="admin-users" class="simasi-nav">♙ Pengelolaan User</button>
    <button data-page="password-reset-requests" class="simasi-nav">🔐 Permintaan Reset Password</button>
    <div class="my-4 border-t border-white/10"></div>
    <button class="simasi-nav disabled" disabled>▤ Manajemen Kuliah <span class="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-[9px]">Segera</span></button>
    <button class="simasi-nav disabled" disabled>✎ Logbook Skripsi <span class="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-[9px]">Segera</span></button>
    <div class="my-4 border-t border-white/10"></div><button data-action="logout" class="simasi-nav text-rose-200">← Keluar</button>`
}
function staffNav(){
  return `<p class="px-3 py-2 text-[10px] font-bold uppercase tracking-[.2em] text-slate-400">Staf Akademik</p>
    <button data-page="staff-dashboard" class="simasi-nav">▦ Dashboard Staf</button>
    <button data-page="admin-registrations" class="simasi-nav">☷ Monitoring Pendaftar</button>
    <button data-page="admin-import" class="simasi-nav">⇧ Import Data Mahasiswa</button>
    <button data-page="password-reset-requests" class="simasi-nav">🔐 Permintaan Reset Password</button>
    <div class="my-4 border-t border-white/10"></div><button data-action="logout" class="simasi-nav text-rose-200">← Keluar</button>`
}
function lecturerNav(){
  return `<p class="px-3 py-2 text-[10px] font-bold uppercase tracking-[.2em] text-slate-400">Dosen</p>
    <button data-page="lecturer-dashboard" class="simasi-nav">▦ Dashboard Dosen</button>
    <div class="my-4 border-t border-white/10"></div>
    <button class="simasi-nav disabled" disabled>▤ Manajemen Kuliah <span class="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-[9px]">Segera</span></button>
    <button class="simasi-nav disabled" disabled>✎ Bimbingan Skripsi <span class="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-[9px]">Segera</span></button>
    <div class="my-4 border-t border-white/10"></div><button data-action="logout" class="simasi-nav text-rose-200">← Keluar</button>`
}
function studentNav(){
  return `<p class="px-3 py-2 text-[10px] font-bold uppercase tracking-[.2em] text-slate-400">Menu Utama</p>
    <button data-page="student-dashboard" class="simasi-nav">▦ Dashboard</button>
    <button data-page="seminar" class="simasi-nav">✓ Pendaftaran Seminar</button>
    <button data-page="student-applications" class="simasi-nav">◷ Monitor Pengajuan</button>
    <div class="my-4 border-t border-white/10"></div>
    <button class="simasi-nav disabled" disabled>▤ Manajemen Kuliah <span class="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-[9px]">Segera</span></button>
    <button class="simasi-nav disabled" disabled>✎ Logbook Skripsi <span class="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-[9px]">Segera</span></button>
    <div class="my-4 border-t border-white/10"></div><button data-action="logout" class="simasi-nav text-rose-200">← Keluar</button>`
}

export function privateShell(){
  const name=state.profile?.full_name||state.user?.email||'Pengguna',initial=name.charAt(0).toUpperCase()
  const nav=isAdmin()?adminNav():isStaff()?staffNav():isLecturer()?lecturerNav():studentNav()
  return `<div class="min-h-screen bg-[#f7f9fc]">
    <div id="mobileOverlay" data-action="close-menu" class="fixed inset-0 z-40 hidden bg-slate-950/50 lg:hidden"></div>
    <aside id="sidebar" class="simasi-sidebar fixed inset-y-0 left-0 z-50 flex w-72 -translate-x-full flex-col text-white transition lg:translate-x-0">
      <div class="flex h-20 items-center border-b border-white/10 px-5">${logo('h-12 w-12')}<div class="ml-3 min-w-0"><p class="text-lg font-extrabold">SIMASI</p><p class="truncate text-[10px] text-slate-300">FMIPA • Universitas Sulawesi Barat</p></div><button data-action="close-menu" class="ml-auto lg:hidden">✕</button></div>
      <nav class="custom-scroll flex-1 overflow-y-auto p-4">${nav}</nav>
      <div class="border-t border-white/10 p-4"><div class="flex items-center rounded-2xl bg-white/5 p-3"><div class="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 font-extrabold">${esc(initial)}</div><div class="ml-3 min-w-0"><p class="truncate text-sm font-bold">${esc(name)}</p><p class="text-[10px] text-slate-400">${esc(state.profile?.role||'')}</p></div></div></div>
    </aside>
    <div class="private-shell min-h-screen lg:pl-72">
      <header class="sticky top-0 z-30 flex h-20 items-center border-b border-slate-200 bg-white/95 px-4 backdrop-blur md:px-8"><button data-action="open-menu" class="mr-3 rounded-xl border p-2 lg:hidden">☰</button><div><p id="pageEyebrow" class="text-xs font-extrabold uppercase tracking-[.16em] text-emerald-700">SIMASI</p><h1 id="pageTitle" class="mt-1 text-lg font-extrabold md:text-xl">Dashboard</h1></div><div class="ml-auto hidden text-right sm:block"><p class="max-w-52 truncate text-sm font-bold">${esc(name)}</p><p class="text-[10px] text-slate-500">${esc(state.profile?.role||'')}</p></div><div class="ml-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[#182e79] font-extrabold text-white">${esc(initial)}</div></header>
      <main id="privateMain" class="p-4 md:p-6 xl:p-8"></main>
    </div>${passwordModal()}
  </div>`
}

export function titleFor(page){
  const m={
    'admin-dashboard':['Dashboard Admin','Administrator SIMASI'],
    'staff-dashboard':['Dashboard Staf','Staf Akademik SIMASI'],
    'lecturer-dashboard':['Dashboard Dosen','Dosen SIMASI'],
    'admin-registrations':['Monitoring Pendaftar','Verifikasi Berkas Seminar'],
    'admin-announcements':['Informasi Akademik','Administrator SIMASI'],
    'admin-import':['Import Data Mahasiswa',isStaff()&&!isAdmin()?'Staf Akademik SIMASI':'Administrator SIMASI'],
    'admin-users':['Pengelolaan User','Administrator SIMASI'],
    'password-reset-requests':['Permintaan Reset Password',isAdmin()?'Administrator SIMASI':'Staf Akademik SIMASI'],
    'student-dashboard':['Dashboard','Mahasiswa SIMASI'],
    'student-applications':['Monitor Pengajuan','Mahasiswa SIMASI'],
    seminar:['Seminar Proposal/Seminar Hasil','Layanan Mahasiswa']
  }
  return m[page]||['SIMASI','FMIPA']
}

const stat=(label,id)=>`<div class="simasi-card p-5"><p class="text-xs font-bold uppercase text-slate-500">${label}</p><p id="${id}" class="mt-2 text-3xl font-extrabold">-</p></div>`
export function adminDashboardHtml(staff=false){
  return `<div class="simasi-hero rounded-3xl p-7 text-white"><p class="text-xs font-extrabold uppercase tracking-[.16em] text-emerald-200">${staff?'Staf Akademik':'Administrator'} SIMASI</p><h2 class="mt-3 text-3xl font-extrabold">Dashboard ${staff?'Staf':'Admin'}</h2><p class="mt-2 text-sm text-slate-200">Ringkasan proses verifikasi Seminar Proposal dan Seminar Hasil FMIPA.</p></div>
    <div id="adminStats" class="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">${stat('Mahasiswa','statStudents')}${stat('Total Pengajuan','statRegs')}${stat('Perlu Verifikasi','statPending')}${stat('Berkas Lengkap','statComplete')}</div>
    <div class="mt-6 grid gap-6 xl:grid-cols-[1.3fr_.7fr]"><div class="simasi-card overflow-hidden"><div class="flex items-center justify-between border-b p-5"><div><h3 class="font-extrabold">Pengajuan Terbaru</h3><p class="mt-1 text-xs text-slate-500">Pengajuan yang perlu dipantau.</p></div><button data-page="admin-registrations" class="rounded-xl border px-4 py-2 text-xs font-extrabold">Lihat Semua</button></div><div class="overflow-x-auto"><table class="simasi-table min-w-full text-sm"><thead class="bg-slate-50"><tr><th class="p-4 text-left">Mahasiswa</th><th class="p-4 text-left">Jenis</th><th class="p-4 text-left">Status</th><th class="p-4 text-left">Tanggal</th></tr></thead><tbody id="recentRegs"><tr><td colspan="4" class="p-8 text-center text-slate-500">Memuat...</td></tr></tbody></table></div></div><div class="simasi-card p-5"><h3 class="font-extrabold">Akses Cepat</h3><div class="mt-4 grid gap-3"><button data-page="admin-registrations" class="rounded-xl bg-[#182e79] px-4 py-3 text-left text-sm font-extrabold text-white">Monitoring Pendaftar</button>${staff?`<button data-page="admin-import" class="rounded-xl border px-4 py-3 text-left text-sm font-extrabold">Import Mahasiswa</button>`:`<button data-page="admin-announcements" class="rounded-xl border px-4 py-3 text-left text-sm font-extrabold">Informasi Akademik</button><button data-page="admin-import" class="rounded-xl border px-4 py-3 text-left text-sm font-extrabold">Import Mahasiswa</button>`}</div></div></div>`
}

export function lecturerDashboardHtml(){
  const prodi=normalizeProdi(state.profile?.prodi||'')||'-'
  return `<div class="simasi-hero rounded-3xl p-7 text-white"><p class="text-xs font-extrabold uppercase tracking-[.16em] text-cyan-100">Dosen SIMASI</p><h2 class="mt-3 text-3xl font-extrabold">Dashboard Dosen</h2><p class="mt-2 text-sm text-slate-200">Akun dosen dipisahkan dari Staff Akademik. Modul dosen akan tersedia pada pengembangan berikutnya.</p></div><div class="mt-6 grid gap-4 md:grid-cols-2"><div class="simasi-card p-6"><p class="text-xs font-extrabold uppercase tracking-[.14em] text-slate-400">Program Studi</p><p class="mt-2 text-xl font-extrabold">${esc(prodi)}</p></div><div class="simasi-card p-6"><p class="text-xs font-extrabold uppercase tracking-[.14em] text-slate-400">Akses Saat Ini</p><p class="mt-2 text-xl font-extrabold">Modul Dosen Segera</p><p class="mt-2 text-sm text-slate-500">Dosen tidak memiliki akses Monitoring Pendaftar Seminar.</p></div></div>`
}

export function registrationsHtml(){
  return `<div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><p class="text-xs font-extrabold uppercase tracking-[.16em] text-emerald-700">Verifikasi Seminar</p><h2 class="mt-2 text-2xl font-extrabold">Monitoring Pendaftar</h2><p class="mt-1 text-sm text-slate-500">Periksa 10 dokumen, beri catatan, minta perbaikan, atau nyatakan berkas lengkap.</p></div><button data-action="refresh-registrations" class="rounded-xl border px-4 py-2 text-sm font-extrabold">↻ Refresh</button></div>
    <div class="mt-6 simasi-card p-4"><div class="grid gap-3 md:grid-cols-4"><input id="regSearch" class="rounded-xl border px-3 py-2.5 text-sm" placeholder="Cari NIM / nama"><select id="regProdi" class="rounded-xl border px-3 py-2.5 text-sm"><option value="">Semua Prodi</option>${PRODI.map(p=>`<option>${p}</option>`).join('')}</select><select id="regType" class="rounded-xl border px-3 py-2.5 text-sm"><option value="">Semua Jenis</option><option>Seminar Proposal</option><option>Seminar Hasil</option></select><select id="regStatus" class="rounded-xl border px-3 py-2.5 text-sm"><option value="">Semua Status</option><option value="diajukan">Diajukan</option><option value="diverifikasi">Diverifikasi</option><option value="perbaikan">Perbaikan</option><option value="lengkap">Berkas Lengkap</option><option value="gagal_upload">Gagal Upload</option></select></div></div>
    <div class="mt-4 simasi-card overflow-hidden"><div class="overflow-x-auto"><table class="simasi-table min-w-full text-sm"><thead class="bg-slate-50"><tr><th class="p-4 text-left">Mahasiswa</th><th class="p-4 text-left">Prodi</th><th class="p-4 text-left">Jenis</th><th class="p-4 text-left">Kelengkapan</th><th class="p-4 text-left">Status</th><th class="p-4 text-left">Aksi</th></tr></thead><tbody id="registrationRows"><tr><td colspan="6" class="p-8 text-center text-slate-500">Memuat...</td></tr></tbody></table></div></div>`
}

export function announcementsHtml(){
  const today=new Date().toISOString().slice(0,10)
  return `<div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><p class="text-xs font-extrabold uppercase tracking-[.16em] text-emerald-700">Landing Page</p><h2 class="mt-2 text-2xl font-extrabold">Informasi Akademik</h2><p class="mt-1 text-sm text-slate-500">Kelola Informasi Terbaru yang tampil pada halaman depan SIMASI.</p></div><button data-action="new-announcement" class="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-extrabold text-white">+ Informasi Baru</button></div>
    <div class="mt-6 grid gap-6 xl:grid-cols-[.8fr_1.2fr]"><form id="announcementForm" class="simasi-card p-6"><input id="announcementId" type="hidden"><h3 id="announcementFormTitle" class="text-lg font-extrabold">Tambah Informasi</h3><div class="mt-5 space-y-4"><div><label class="mb-2 block text-xs font-bold text-slate-600">Judul</label><input id="announcementTitle" required maxlength="180" class="w-full rounded-xl border px-4 py-3" placeholder="Judul informasi"></div><div><label class="mb-2 block text-xs font-bold text-slate-600">Tanggal</label><input id="announcementDate" type="date" required value="${today}" class="w-full rounded-xl border px-4 py-3"></div><div><label class="mb-2 block text-xs font-bold text-slate-600">Isi Informasi</label><textarea id="announcementBody" required rows="6" class="w-full rounded-xl border px-4 py-3" placeholder="Isi pengumuman atau informasi akademik"></textarea></div><label class="flex items-center gap-3 rounded-xl bg-slate-50 p-3 text-sm"><input id="announcementActive" type="checkbox" checked class="h-4 w-4"><span>Tampilkan di landing page</span></label><div class="flex gap-3"><button class="flex-1 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-extrabold text-white">Simpan</button><button type="button" data-action="reset-announcement" class="rounded-xl border px-4 py-3 text-sm font-extrabold">Reset</button></div></div></form><div class="simasi-card overflow-hidden"><div class="border-b p-5"><h3 class="font-extrabold">Daftar Informasi</h3></div><div id="announcementRows" class="divide-y"><div class="p-6 text-sm text-slate-500">Memuat...</div></div></div></div>`
}

export function studentDashboardHtml(){
  const name=state.profile?.full_name||'Mahasiswa',nim=state.profile?.nim||'-',prodi=state.profile?.prodi||'-'
  return `<div class="simasi-hero rounded-3xl p-7 text-white"><p class="text-xs font-extrabold uppercase tracking-[.16em] text-emerald-200">Dashboard Mahasiswa</p><h2 class="mt-3 text-3xl font-extrabold">Selamat datang, ${esc(name)}</h2><p class="mt-2 text-sm text-slate-200">Kelola pendaftaran dan pantau hasil verifikasi berkas seminar Anda.</p></div><div class="mt-6 grid gap-4 md:grid-cols-3"><div class="simasi-card p-5"><p class="text-xs font-bold uppercase text-slate-500">NIM</p><p class="mt-2 text-xl font-extrabold">${esc(nim)}</p></div><div class="simasi-card p-5"><p class="text-xs font-bold uppercase text-slate-500">Program Studi</p><p class="mt-2 text-xl font-extrabold">${esc(prodi)}</p></div><div class="simasi-card p-5"><p class="text-xs font-bold uppercase text-slate-500">Status Akun</p><p class="mt-2 text-xl font-extrabold text-emerald-700">Aktif</p></div></div><div class="mt-6 grid gap-6 xl:grid-cols-[.85fr_1.15fr]"><div class="simasi-card p-6"><h3 class="text-lg font-extrabold">Layanan Seminar</h3><p class="mt-2 text-sm leading-6 text-slate-500">Ajukan Seminar Proposal atau Seminar Hasil dan unggah persyaratan.</p><div class="mt-5 flex flex-wrap gap-3"><button data-page="seminar" class="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-extrabold text-white">Daftar Seminar</button><button data-page="student-applications" class="rounded-xl border px-5 py-3 text-sm font-extrabold">Monitor Pengajuan</button></div></div><div class="simasi-card overflow-hidden"><div class="border-b p-5"><h3 class="font-extrabold">Riwayat Terbaru</h3></div><div id="studentHistory" class="p-5 text-sm text-slate-500">Memuat...</div></div></div>`
}

export function studentApplicationsHtml(){
  return `<div class="flex flex-col gap-2"><p class="text-xs font-extrabold uppercase tracking-[.16em] text-emerald-700">Siklus Pendaftaran</p><h2 class="text-2xl font-extrabold">Monitor Pengajuan Seminar</h2><p class="text-sm text-slate-500">Pantau status, catatan verifikator, dan perbaiki dokumen yang diminta.</p></div><div id="studentApplicationList" class="mt-6 grid gap-5"><div class="simasi-card p-6 text-sm text-slate-500">Memuat pengajuan...</div></div>`
}

export function seminarHtml(){
  const profileProdi=normalizeProdi(state.profile?.prodi||'');if(!state.selectedProdi&&profileProdi)state.selectedProdi=profileProdi
  return `<div class="simasi-hero rounded-3xl p-7 text-white"><p class="text-xs font-extrabold uppercase tracking-[.16em] text-emerald-200">FMIPA Universitas Sulawesi Barat</p><h2 class="mt-3 text-3xl font-extrabold">Pendaftaran Seminar</h2><p class="mt-2 text-sm text-slate-200">Pilih jenis seminar, unggah 10 PDF maksimal 2 MB, preview, lalu kirim.</p></div>
    <div class="mt-6 simasi-card p-6"><h3 class="text-xl font-extrabold">Tahap 1 • Program Studi</h3><p class="mt-1 text-sm text-slate-500">Program studi mengikuti data akun hasil import admin.</p><div class="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">${PRODI.map(p=>`<button type="button" data-action="choose-prodi" data-prodi="${p}" class="prodi-card ${state.selectedProdi===p?'selected':''} ${profileProdi&&profileProdi!==p?'locked':''} rounded-2xl border-2 p-5 text-left"><div class="text-2xl">${p==='Matematika'?'∑':p==='Statistika'?'▥':p==='Aktuaria'?'↗':'⌘'}</div><h4 class="mt-3 font-extrabold">${p}</h4></button>`).join('')}</div></div>
    <form id="seminarForm" class="mt-6 simasi-card p-6"><div><h3 class="text-xl font-extrabold">Tahap 2 • Data Pendaftaran</h3><p class="mt-1 text-sm text-slate-500">Prodi terpilih: <b class="text-emerald-700">${esc(state.selectedProdi||'-')}</b></p></div><div class="mt-5 grid gap-4 md:grid-cols-2"><input id="semNim" readonly value="${esc(state.profile?.nim||'')}" class="rounded-xl border bg-slate-50 px-4 py-3"><input id="semNama" readonly value="${esc(state.profile?.full_name||'')}" class="rounded-xl border bg-slate-50 px-4 py-3"></div><div class="mt-5 grid gap-3 md:grid-cols-2"><label class="rounded-2xl border bg-slate-50 p-4"><input type="radio" name="examType" value="Seminar Proposal" class="accent-emerald-600"> <b>Seminar Proposal</b></label><label class="rounded-2xl border bg-slate-50 p-4"><input type="radio" name="examType" value="Seminar Hasil" class="accent-emerald-600"> <b>Seminar Hasil</b></label></div>
    <div class="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h3 class="font-extrabold">Tahap 3 • Berkas Persyaratan</h3><p class="mt-1 text-xs text-slate-500">Preview PDF sebelum mengirim untuk memastikan dokumen benar.</p></div><div class="flex items-center gap-2"><span id="docProgress" class="rounded-full bg-slate-100 px-3 py-1 text-xs font-extrabold">0 / ${DOCS.length}</span><button type="button" data-action="preview-all-docs" class="rounded-xl border px-3 py-2 text-xs font-extrabold">Preview Semua</button></div></div><div class="mt-3 space-y-3">${DOCS.map(docRow).join('')}</div>
    <div class="mt-6 flex flex-col gap-3 rounded-2xl bg-slate-50 p-4 md:flex-row md:items-center md:justify-between"><p id="semMessage" class="text-xs text-slate-500">Lengkapi seluruh persyaratan.</p><button id="submitSeminar" type="submit" data-ready="false" class="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-extrabold text-white">Kirim Berkas Pendaftaran</button></div><div id="submitProgressBox" class="mt-4 hidden rounded-2xl border border-blue-100 bg-blue-50 p-4"><div class="flex items-center justify-between text-xs font-bold text-blue-800"><span id="submitProgressText">Menyiapkan...</span><span id="submitProgressCount">0%</span></div><div class="mt-3 h-2 overflow-hidden rounded-full bg-blue-100"><div id="submitProgressBar" class="h-full w-0 rounded-full bg-[linear-gradient(90deg,#0a7bb5,#2235ae,#491699)] transition-all"></div></div></div></form>`
}

function docRow([key,label],i){
  return `<div class="doc-row rounded-2xl border bg-white p-4" data-key="${key}"><div class="flex flex-col gap-3 lg:flex-row lg:items-center"><div class="flex min-w-0 flex-1 items-start gap-3"><span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-xs font-extrabold text-emerald-700">${i+1}</span><div><b class="text-sm">${esc(label)}</b><p class="mt-1 text-[11px] text-slate-500">PDF • maksimal 2 MB</p></div></div><div class="flex flex-col gap-2 sm:flex-row lg:w-[52%]"><label class="flex-1 cursor-pointer rounded-xl border border-dashed bg-slate-50 px-3 py-3 text-center text-xs font-bold hover:border-emerald-300 hover:bg-emerald-50"><input class="doc-input hidden" data-key="${key}" type="file" accept="application/pdf,.pdf"><span class="file-name">Pilih PDF</span></label><button type="button" data-action="preview-local-doc" data-key="${key}" class="hidden rounded-xl border border-blue-100 px-3 py-2 text-xs font-bold text-blue-700">Preview</button><button type="button" data-action="remove-doc" data-key="${key}" class="hidden rounded-xl border border-rose-100 px-3 py-2 text-xs font-bold text-rose-600">Hapus</button><span class="doc-badge self-center rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500">Belum Diisi</span></div></div></div>`
}
