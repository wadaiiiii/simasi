import { logo } from './core.js'

function loginModal(){
  return `<div id="loginModal" class="fixed inset-0 z-[800] hidden overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm">
    <div class="mx-auto flex min-h-full max-w-md items-center justify-center py-8">
      <div class="w-full overflow-hidden rounded-[28px] border border-white/50 bg-white shadow-2xl">
        <div class="h-2 bg-[linear-gradient(90deg,#eb485d_0%,#0a7bb5_48%,#2235ae_72%,#491699_100%)]"></div>
        <div class="p-6 sm:p-8">
          <div class="flex items-start justify-between gap-4">
            <div class="flex items-center gap-3">${logo('h-14 w-14')}<div><p class="text-[11px] font-extrabold uppercase tracking-[.18em] text-[#2235ae]">SIMASI FMIPA</p><h2 class="mt-1 text-2xl font-extrabold text-slate-950">Masuk ke Sistem</h2></div></div>
            <button data-action="close-login" class="rounded-xl border border-slate-200 px-3 py-2 font-bold text-slate-500 hover:bg-slate-50">✕</button>
          </div>
          <form id="loginForm" class="mt-7 space-y-4">
            <div><label class="mb-2 block text-sm font-bold text-slate-700">NIM / Email</label><input id="loginId" required autocomplete="username" class="w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3.5 outline-none transition focus:border-[#0a7bb5] focus:bg-white focus:ring-4 focus:ring-[#0a7bb5]/10" placeholder="Masukkan NIM atau email"></div>
            <div><label class="mb-2 block text-sm font-bold text-slate-700">Password</label><input id="loginPassword" type="password" required autocomplete="current-password" class="w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3.5 outline-none transition focus:border-[#2235ae] focus:bg-white focus:ring-4 focus:ring-[#2235ae]/10" placeholder="Masukkan password"></div>
            <button class="w-full rounded-2xl bg-[linear-gradient(90deg,#0a7bb5_0%,#2235ae_58%,#491699_100%)] px-5 py-3.5 font-extrabold text-white shadow-lg shadow-[#2235ae]/20 transition hover:-translate-y-0.5">Masuk</button>
          </form>
          <div id="loginError" class="mt-4 hidden rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"></div>
          <button id="forgotPassword" class="mt-5 w-full text-center text-xs font-extrabold text-[#2235ae]">Lupa password?</button>
        </div>
      </div>
    </div>
  </div>`
}

export function landingHtml(){
  return `<div class="min-h-screen bg-[#f7f8fc] text-slate-900">
    <header class="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur">
      <div class="mx-auto flex max-w-6xl items-center gap-3 px-4 py-4 sm:px-5 lg:px-8">
        ${logo('h-11 w-11 sm:h-12 sm:w-12')}
        <div class="min-w-0"><div class="text-lg font-extrabold tracking-tight text-[#182e79]">SIMASI</div><div class="truncate text-[10px] font-semibold text-slate-500 sm:text-[11px]">FMIPA • Universitas Sulawesi Barat</div></div>
        <button data-action="open-login" class="ml-auto rounded-2xl bg-[#182e79] px-4 py-2.5 text-sm font-extrabold text-white shadow-sm transition hover:bg-[#2235ae] sm:px-5">Login</button>
      </div>
    </header>

    <main>
      <section class="relative overflow-hidden">
        <div class="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(235,72,93,.10),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(73,22,153,.10),transparent_36%)]"></div>
        <div class="relative mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-5 sm:py-14 lg:grid-cols-[1.1fr_.9fr] lg:items-center lg:px-8 lg:py-16">
          <div>
            <span class="inline-flex rounded-full border border-[#0a7bb5]/15 bg-[#0a7bb5]/5 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[.15em] text-[#0a7bb5] sm:text-[11px]">Portal Akademik FMIPA</span>
            <h1 class="mt-5 max-w-3xl text-3xl font-extrabold leading-tight tracking-tight text-slate-950 sm:text-4xl lg:text-5xl">Seminar Proposal & Seminar Hasil dalam <span class="bg-[linear-gradient(90deg,#0a7bb5,#2235ae,#491699)] bg-clip-text text-transparent">satu layanan</span>.</h1>
            <p class="mt-4 max-w-xl text-sm leading-7 text-slate-600 sm:text-base">Akses informasi akademik dan layanan seminar FMIPA Universitas Sulawesi Barat secara lebih ringkas dan terintegrasi.</p>
            <div class="mt-6 flex flex-col gap-3 sm:flex-row">
              <button data-action="open-login" class="rounded-2xl bg-[linear-gradient(90deg,#0a7bb5_0%,#2235ae_58%,#491699_100%)] px-5 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-[#2235ae]/20 transition hover:-translate-y-0.5">Masuk ke SIMASI</button>
              <a href="#informasi" class="rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-center text-sm font-extrabold text-slate-700 shadow-sm transition hover:border-[#2235ae]/30 hover:text-[#2235ae]">Lihat Informasi Terbaru</a>
            </div>
          </div>

          <div class="relative mx-auto w-full max-w-md lg:max-w-none">
            <div class="rounded-[32px] border border-white/70 bg-white/80 p-5 shadow-xl shadow-slate-200/60 backdrop-blur sm:p-6">
              <div class="flex items-center justify-between gap-4">
                <div><p class="text-[10px] font-extrabold uppercase tracking-[.16em] text-slate-400">Layanan Aktif</p><h2 class="mt-1 text-xl font-extrabold text-slate-950">Pendaftaran Seminar</h2></div>
                <div class="flex gap-2"><span class="h-9 w-3 rounded-full bg-[linear-gradient(180deg,#eb485d,#6d2d90)]"></span><span class="h-9 w-3 rounded-full bg-[linear-gradient(180deg,#0a7bb5,#182e79)]"></span><span class="h-9 w-3 rounded-full bg-[linear-gradient(180deg,#2235ae,#491699)]"></span></div>
              </div>
              <div class="mt-5 grid gap-3 sm:grid-cols-2">
                <div class="rounded-2xl bg-[#0a7bb5]/6 p-4"><p class="text-xs font-bold text-[#0a7bb5]">Seminar Proposal</p><p class="mt-2 text-xs leading-5 text-slate-500">Pengajuan dan unggah persyaratan seminar proposal.</p></div>
                <div class="rounded-2xl bg-[#491699]/6 p-4"><p class="text-xs font-bold text-[#491699]">Seminar Hasil</p><p class="mt-2 text-xs leading-5 text-slate-500">Pengajuan dan unggah persyaratan seminar hasil.</p></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="informasi" class="mx-auto max-w-6xl px-4 pb-14 sm:px-5 lg:px-8 lg:pb-16">
        <div class="flex flex-col gap-2 border-t border-slate-200 pt-8 sm:flex-row sm:items-end sm:justify-between">
          <div><p class="text-[10px] font-extrabold uppercase tracking-[.18em] text-[#eb485d] sm:text-xs">Informasi Akademik</p><h2 class="mt-2 text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">Informasi Terbaru</h2></div>
          <p class="max-w-md text-sm text-slate-500">Pengumuman resmi dan informasi layanan akademik SIMASI.</p>
        </div>
        <section id="landingAnnouncements" class="mt-6 grid gap-4 md:grid-cols-2"><div class="simasi-card p-5 text-sm text-slate-500">Memuat informasi terbaru...</div></section>
      </section>
    </main>

    <footer class="border-t border-slate-200 bg-white"><div class="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-5 lg:px-8"><span>SIMASI • FMIPA Universitas Sulawesi Barat</span><button data-action="open-login" class="font-extrabold text-[#2235ae]">Masuk ke sistem</button></div></footer>
    ${loginModal()}
  </div>`
}
