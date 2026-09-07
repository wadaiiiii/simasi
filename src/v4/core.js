import { supabaseClient, hasSupabaseConfiguration } from '../supabase.js'

export { supabaseClient, hasSupabaseConfiguration }
export const $ = (s) => document.querySelector(s)
export const $$ = (s) => [...document.querySelectorAll(s)]
export const esc = (v) => String(v ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;')
export const fmt = (v) => v ? new Date(v).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'}) : '-'
export const LOGO = 'https://akademik.unsulbar.ac.id/images/logo-unsulbar.png'
export const PRODI = ['Matematika','Statistika','Aktuaria','Bioteknologi']
export const DOCS = [
  ['persetujuan_ta','Halaman Persetujuan Tugas Akhir'],
  ['krs','Kartu Rencana Studi Semester Terakhir'],
  ['khs','Kartu Hasil Studi Semester Terakhir'],
  ['transkrip','Transkrip Nilai Terakhir'],
  ['ijazah','Fotocopy Ijazah SMA'],
  ['ktp','Fotocopy KTP'],
  ['kontrol_pembimbing','Kartu Kontrol Pembimbing'],
  ['kontrol_seminar','Kartu Kontrol Mengikuti Seminar'],
  ['sk_kegiatan','SK Kegiatan'],
  ['pas_foto','Pas Foto 3x4 (2 lembar dalam satu PDF)']
]
export const MAX_FILE = 2 * 1024 * 1024
export const state = {user:null,profile:null,page:'landing',selectedProdi:'',importRows:[],registrations:[],docs:[],users:[],recovery:false}

export const role = () => String(state.profile?.role || '').toLowerCase()
export const isAdmin = () => role() === 'admin'
export const isStudent = () => role() === 'mahasiswa'
export const normalizeNim = (v) => String(v ?? '').trim().replace(/\s+/g,'').toUpperCase()
export const normalizeProdi = (v) => { const s=String(v??'').toLowerCase(); return PRODI.find(p=>s.includes(p.toLowerCase())) || '' }
export const loginEmail = (v) => { const s=String(v??'').trim(); return s.includes('@') ? s.toLowerCase() : `${normalizeNim(s).toLowerCase()}@students.simasi.local` }

export function toast(message,type='ok'){
  const el=$('#toast'); if(!el)return
  el.textContent=message
  el.className=`fixed bottom-5 right-5 z-[1100] max-w-md rounded-2xl px-5 py-4 text-sm font-bold text-white shadow-2xl ${type==='err'?'bg-rose-600':type==='info'?'bg-slate-900':'bg-emerald-600'}`
  el.classList.remove('hidden'); setTimeout(()=>el.classList.add('hidden'),5200)
}
export function loading(on,text='Memproses...'){
  const el=$('#loading'); if(!el)return
  if(el.firstElementChild) el.firstElementChild.textContent=text
  el.classList.toggle('hidden',!on); el.classList.toggle('flex',on)
}
export async function edge(name,body){
  const {data,error}=await supabaseClient.functions.invoke(name,{body})
  if(error){
    let msg=error.message||`${name} gagal.`
    try{const res=error.context;if(res?.clone){const j=await res.clone().json();msg=j?.message||j?.error||msg}}catch{}
    throw new Error(msg)
  }
  if(data?.ok===false) throw new Error(data.message||`${name} gagal.`)
  return data
}
export function logo(size='h-14 w-14'){
  return `<div class="simasi-logo-frame ${size} shrink-0 rounded-2xl border border-slate-200 bg-white"><img src="${LOGO}" alt="Logo Universitas Sulawesi Barat"></div>`
}
export function statusBadge(status){
  const map={diajukan:'bg-amber-50 text-amber-700',diverifikasi:'bg-blue-50 text-blue-700',perbaikan:'bg-rose-50 text-rose-700',disetujui:'bg-emerald-50 text-emerald-700',gagal_upload:'bg-rose-50 text-rose-700'}
  return `<span class="simasi-pill ${map[status]||'bg-slate-100 text-slate-600'}">${esc(status||'-')}</span>`
}
export async function refreshSession(){
  if(!hasSupabaseConfiguration){state.user=null;state.profile=null;return}
  const {data}=await supabaseClient.auth.getSession()
  state.user=data.session?.user||null; state.profile=null
  if(state.user){
    const p=await supabaseClient.from('profiles').select('*').eq('id',state.user.id).maybeSingle()
    state.profile=p.data||{id:state.user.id,email:state.user.email,full_name:state.user.user_metadata?.full_name||state.user.email,role:'mahasiswa'}
  }
}
