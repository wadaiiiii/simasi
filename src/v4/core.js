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
export const state = {
  user:null,
  profile:null,
  page:'landing',
  selectedProdi:'',
  importRows:[],
  registrations:[],
  docs:[],
  users:[],
  announcements:[],
  studentApplications:[],
  recovery:false
}

export const role = () => String(state.profile?.role || '').toLowerCase()
export const isAdmin = () => role() === 'admin'
export const isStaff = () => ['staff','admin'].includes(role())
export const isLecturer = () => role() === 'dosen'
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

async function activeSession(forceRefresh=false){
  if(!supabaseClient)throw new Error('Koneksi backend belum tersedia.')
  if(forceRefresh){
    const refreshed=await supabaseClient.auth.refreshSession()
    if(refreshed.error||!refreshed.data?.session)throw new Error('Sesi login telah berakhir. Silakan login kembali.')
    return refreshed.data.session
  }
  const current=await supabaseClient.auth.getSession()
  if(current.error||!current.data?.session)throw new Error('Sesi login tidak ditemukan. Silakan login kembali.')
  let session=current.data.session
  const expiresAt=Number(session.expires_at||0)*1000
  if(expiresAt&&expiresAt-Date.now()<60000){
    const refreshed=await supabaseClient.auth.refreshSession()
    if(refreshed.error||!refreshed.data?.session)throw new Error('Sesi login telah berakhir. Silakan login kembali.')
    session=refreshed.data.session
  }
  return session
}

async function invokeEdge(name,body,forceRefresh=false){
  const session=await activeSession(forceRefresh)
  return supabaseClient.functions.invoke(name,{
    body,
    headers:{Authorization:`Bearer ${session.access_token}`}
  })
}

function edgeErrorMessage(error,name){
  let msg=error?.message||`${name} gagal.`
  try{
    const res=error?.context
    if(res?.clone){
      return res.clone().json().then(j=>j?.message||j?.error||msg).catch(()=>msg)
    }
  }catch{}
  return Promise.resolve(msg)
}

export async function edge(name,body){
  let result=await invokeEdge(name,body,false)
  if(result.error){
    const firstMsg=await edgeErrorMessage(result.error,name)
    const status=Number(result.error?.context?.status||0)
    const unauthorized=status===401||String(firstMsg).toLowerCase().includes('unauthorized')
    if(unauthorized){
      try{result=await invokeEdge(name,body,true)}catch(e){throw e}
    }
  }
  const {data,error}=result
  if(error)throw new Error(await edgeErrorMessage(error,name))
  if(data?.ok===false) throw new Error(data.message||`${name} gagal.`)
  return data
}
export function logo(size='h-14 w-14'){
  return `<div class="simasi-logo-frame ${size} shrink-0 rounded-2xl border border-slate-200 bg-white"><img src="${LOGO}" alt="Logo Universitas Sulawesi Barat"></div>`
}
export function statusBadge(status){
  const value=String(status||'').toLowerCase()
  const label={
    diajukan:'Diajukan',
    diverifikasi:'Diverifikasi',
    perbaikan:'Perbaikan',
    lengkap:'Berkas Lengkap',
    disetujui:'Berkas Lengkap',
    gagal_upload:'Gagal Upload',
    terunggah:'Terunggah',
    valid:'Valid'
  }[value] || status || '-'
  const map={
    diajukan:'bg-amber-50 text-amber-700',
    diverifikasi:'bg-blue-50 text-blue-700',
    perbaikan:'bg-rose-50 text-rose-700',
    lengkap:'bg-emerald-50 text-emerald-700',
    disetujui:'bg-emerald-50 text-emerald-700',
    gagal_upload:'bg-rose-50 text-rose-700',
    terunggah:'bg-slate-100 text-slate-600',
    valid:'bg-emerald-50 text-emerald-700'
  }
  return `<span class="simasi-pill ${map[value]||'bg-slate-100 text-slate-600'}">${esc(label)}</span>`
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
