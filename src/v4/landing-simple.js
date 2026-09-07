import { logo } from './core.js'

function loginModal(){
  return `<div id="loginModal" class="fixed inset-0 z-[800] hidden overflow-y-auto bg-slate-950/55 p-4 backdrop-blur-sm">
    <div class="mx-auto flex min-h-full max-w-md items-center justify-center py-8">
      <div class="w-full rounded-3xl bg-white p-7 shadow-2xl md:p-9">
        <div class="flex items-start justify-between gap-4">
          <div class="flex items-center gap-3">${logo('h-14 w-14')}<div><p class="text-xs font-extrabold uppercase tracking-[.16em] text-emerald-700">SIMASI FMIPA</p><h2 class="mt-1 text-2xl font-extrabold text-slate-900">Masuk ke Sistem</h2></div></div>
          <button data-action="close-login" class="rounded-xl border border-slate-200 px-3 py-2 font-bold text-slate-500">✕</button>
        </div>
        <form id="loginForm" class="mt-7 space-y-4">
          <div><label class="mb-2 block text-sm font-bold text-slate-700">NIM / Email</label><input id="loginId" required autocomplete="username" class="w-full rounded-xl border border-slate-200 px-4 py-3.5 outline-none focus:border-emerald-500" placeholder="NIM atau email"></div>
          <div><label class="mb-2 block text-sm font-bold text-slate-700">Password</label><input id="loginPassword" type="password" required autocomplete="current-password" class="w-full rounded-xl border border-slate-200 px-4 py-3.5 outline-none focus:border-emerald-500" placeholder="Password"></div>
          <button class="w-full rounded-xl bg-[#0f2747] px-5 py-3.5 font-extrabold text-white hover:bg-[#173a64]">Masuk</button>
        </form>
        <div id="loginError" class="mt-4 hidden rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"></div>
        <button id="forgotPassword" class="mt-5 w-full text-center text-xs font-extrabold text-emerald-700">Lupa password staf/admin?</button>
      </div>
    </div>
  </div>`
}

export function landingHtml(){
  return `<div class="min-h-screen bg-[#f7f9fc] text-slate-900">
    <header class="border-b border-slate-200 bg-white">
      <div class="mx-auto flex max-w-6xl items-center gap-3 px-5 py-4 lg:px-8">
        ${logo('h-12 w-12')}
        <div class="min-w-0"><div class="text-lg font-extrabold text-[#0f2747]">SIMASI</div><div class="truncate text-[11px] font-semibold text-slate-500">FMIPA • Universitas Sulawesi Barat</div></div>
        <button data-action="open-login" class="ml-auto rounded-xl bg-[#0f2747] px-5 py-2.5 text-sm font-extrabold text-white hover:bg-[#173a64]">Login</button>
      </div>
    </header>
    <main class="mx-auto max-w-6xl px-5 py-10 lg:px-8 lg:py-14">
      <div class="mb-6"><p class="text-xs font-extrabold uppercase tracking-[.18em] text-emerald-700">FMIPA Unsulbar</p><h1 class="mt-2 text-3xl font-extrabold text-slate-900">Informasi Terbaru</h1><p class="mt-2 text-sm text-slate-500">Informasi dan pengumuman akademik SIMASI.</p></div>
      <section id="landingAnnouncements" class="grid gap-4 md:grid-cols-2"><div class="simasi-card p-5 text-sm text-slate-500">Memuat informasi...</div></section>
    </main>
    <footer class="mt-auto border-t border-slate-200 bg-white"><div class="mx-auto max-w-6xl px-5 py-6 text-center text-xs text-slate-500 lg:px-8">SIMASI • FMIPA Universitas Sulawesi Barat</div></footer>
    ${loginModal()}
  </div>`
}
