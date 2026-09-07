const required = ['SUPABASE_PROJECT_REF','SUPABASE_URL','SUPABASE_ACCESS_TOKEN','GOOGLE_OAUTH_CLIENT_ID','GOOGLE_OAUTH_CLIENT_SECRET','GOOGLE_OAUTH_REFRESH_TOKEN']
for (const key of required) if (!process.env[key]) throw new Error(`Missing ${key}`)

const REF = process.env.SUPABASE_PROJECT_REF
const BASE = process.env.SUPABASE_URL
const MGMT = process.env.SUPABASE_ACCESS_TOKEN
const run = process.env.GITHUB_RUN_ID || String(Date.now())
const nim = `N${run}`
const adminEmail = `node-e2e-admin-${run}@students.simasi.local`
const adminPassword = `A9!${crypto.randomUUID().replaceAll('-','').slice(0,24)}`
const studentPassword = `S9!${crypto.randomUUID().replaceAll('-','').slice(0,24)}`
const studentName = 'Mahasiswa Uji Lifecycle Node'

let PUBLIC_KEY = ''
let SERVICE_KEY = ''
let adminId = ''
let adminToken = ''
let studentId = ''
let studentToken = ''
let registrationId = ''
let announcementId = ''
const driveFileIds = []
const driveFolderIds = new Set()

async function responseText(res){
  try{return await res.text()}catch{return ''}
}
async function jsonRequest(url, options={}, label='request'){
  const res = await fetch(url, options)
  const text = await responseText(res)
  if(!res.ok) throw new Error(`${label} HTTP ${res.status}: ${text.slice(0,500)}`)
  if(!text) return null
  try{return JSON.parse(text)}catch{throw new Error(`${label}: response bukan JSON: ${text.slice(0,300)}`)}
}
const userHeaders=(token)=>({apikey:PUBLIC_KEY,Authorization:`Bearer ${token}`,'Content-Type':'application/json'})
const serviceHeaders=()=>({apikey:SERVICE_KEY,Authorization:`Bearer ${SERVICE_KEY}`,'Content-Type':'application/json'})

async function resolveKeys(){
  const keys=await jsonRequest(`https://api.supabase.com/v1/projects/${REF}/api-keys?reveal=true`,{headers:{Authorization:`Bearer ${MGMT}`}},'resolve keys')
  PUBLIC_KEY=keys.find(k=>k.name==='anon')?.api_key || keys.find(k=>k.type==='publishable')?.api_key || ''
  SERVICE_KEY=keys.find(k=>k.name==='service_role')?.api_key || ''
  if(!PUBLIC_KEY||!SERVICE_KEY)throw new Error('Anon/service_role key tidak ditemukan')
}

async function createAdmin(){
  const created=await jsonRequest(`${BASE}/auth/v1/admin/users`,{method:'POST',headers:serviceHeaders(),body:JSON.stringify({email:adminEmail,password:adminPassword,email_confirm:true,user_metadata:{full_name:'Admin Uji Lifecycle Node'}})},'create admin')
  adminId=created.id||created.user?.id
  if(!adminId)throw new Error('Admin ID tidak tersedia')
  await jsonRequest(`${BASE}/rest/v1/profiles?id=eq.${adminId}`,{method:'PATCH',headers:{...serviceHeaders(),Prefer:'return=minimal'},body:JSON.stringify({full_name:'Admin Uji Lifecycle Node',role:'admin',must_change_password:false})},'promote admin')
  const session=await jsonRequest(`${BASE}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:PUBLIC_KEY,'Content-Type':'application/json'},body:JSON.stringify({email:adminEmail,password:adminPassword})},'admin login')
  adminToken=session.access_token
  if(!adminToken)throw new Error('Admin token tidak tersedia')
}

async function createStudent(){
  const imported=await jsonRequest(`${BASE}/functions/v1/import-mahasiswa`,{method:'POST',headers:userHeaders(adminToken),body:JSON.stringify({students:[{nim,nama:studentName,prodi:'Matematika'}]})},'import student')
  if(imported?.ok!==true)throw new Error(`Import student gagal: ${JSON.stringify(imported)}`)
  const email=`${nim.toLowerCase()}@students.simasi.local`
  const first=await jsonRequest(`${BASE}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:PUBLIC_KEY,'Content-Type':'application/json'},body:JSON.stringify({email,password:nim})},'student first login')
  studentId=first.user?.id
  studentToken=first.access_token
  if(!studentId||!studentToken)throw new Error('Student session awal tidak tersedia')

  const changed=await jsonRequest(`${BASE}/functions/v1/change-initial-password`,{method:'POST',headers:userHeaders(studentToken),body:JSON.stringify({new_password:studentPassword})},'change initial password')
  if(changed?.ok!==true)throw new Error(`Change password gagal: ${JSON.stringify(changed)}`)

  // Password change revokes the prior Auth session. Re-authenticate before Edge Functions.
  const fresh=await jsonRequest(`${BASE}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:PUBLIC_KEY,'Content-Type':'application/json'},body:JSON.stringify({email,password:studentPassword})},'student fresh login')
  studentToken=fresh.access_token
  if(!studentToken)throw new Error('Fresh student token tidak tersedia')
}

async function createRegistration(){
  const rows=await jsonRequest(`${BASE}/rest/v1/pendaftaran_seminar`,{method:'POST',headers:{...userHeaders(studentToken),Prefer:'return=representation'},body:JSON.stringify({user_id:studentId,nim,nama:studentName,prodi:'Matematika',jenis_ujian:'Seminar Proposal',pas_foto_jumlah:2,status:'diajukan'})},'create registration')
  registrationId=rows?.[0]?.id
  if(!registrationId)throw new Error('Registration ID tidak tersedia')
}

const DOCS=[
 ['persetujuan_ta','Halaman Persetujuan Tugas Akhir'],['krs','Kartu Rencana Studi Semester Terakhir'],['khs','Kartu Hasil Studi Semester Terakhir'],['transkrip','Transkrip Nilai Terakhir'],['ijazah','Fotocopy Ijazah SMA'],['ktp','Fotocopy KTP'],['kontrol_pembimbing','Kartu Kontrol Pembimbing'],['kontrol_seminar','Kartu Kontrol Mengikuti Seminar'],['sk_kegiatan','SK Kegiatan'],['pas_foto','Pas Foto 3x4']
]
const pdfBytes=new TextEncoder().encode('%PDF-1.4\n% SIMASI lifecycle Node E2E\n1 0 obj << /Type /Catalog >> endobj\n%%EOF\n')

async function uploadDoc(key,label){
  const form=new FormData()
  form.append('file',new Blob([pdfBytes],{type:'application/pdf'}),'simasi-e2e.pdf')
  for(const [k,v] of Object.entries({nim,nama:studentName,prodi:'Matematika',exam_type:'Seminar Proposal',registration_id:registrationId,document_key:key,document_label:label,persist_metadata:'true'}))form.append(k,v)
  const res=await fetch(`${BASE}/functions/v1/upload-seminar-drive`,{method:'POST',headers:{apikey:PUBLIC_KEY,Authorization:`Bearer ${studentToken}`},body:form})
  const text=await responseText(res)
  if(!res.ok)throw new Error(`upload ${key} HTTP ${res.status}: ${text.slice(0,500)}`)
  const data=JSON.parse(text)
  if(data.ok!==true||data.metadata_persisted!==true)throw new Error(`upload ${key} invalid response: ${text}`)
  driveFileIds.push(data.file_id)
  if(data.folder_id)driveFolderIds.add(data.folder_id)
  return data
}

async function uploadAll(){
  for(const [key,label] of DOCS)await uploadDoc(key,label)
  const docs=await jsonRequest(`${BASE}/rest/v1/berkas_seminar?pendaftaran_id=eq.${registrationId}&select=*`,{headers:{apikey:PUBLIC_KEY,Authorization:`Bearer ${studentToken}`}},'read student docs')
  if(docs.length!==10)throw new Error(`Metadata berkas ${docs.length}/10`)
  return docs
}

async function previewFirst(docs){
  const res=await fetch(`${BASE}/functions/v1/preview-seminar-drive`,{method:'POST',headers:userHeaders(studentToken),body:JSON.stringify({document_id:docs[0].id})})
  if(!res.ok)throw new Error(`secure preview HTTP ${res.status}: ${(await responseText(res)).slice(0,400)}`)
  const type=res.headers.get('content-type')||''
  const bytes=new Uint8Array(await res.arrayBuffer())
  if(!type.includes('application/pdf')||bytes.length<20)throw new Error(`Secure preview tidak menghasilkan PDF valid (${type}, ${bytes.length} bytes)`)
}

async function staffRequestsRevision(){
  const now=new Date().toISOString()
  await jsonRequest(`${BASE}/rest/v1/pendaftaran_seminar?id=eq.${registrationId}`,{method:'PATCH',headers:{...userHeaders(adminToken),Prefer:'return=minimal'},body:JSON.stringify({status:'diverifikasi',verified_by:adminId,verified_at:now})},'start verification')
  await jsonRequest(`${BASE}/rest/v1/berkas_seminar?pendaftaran_id=eq.${registrationId}`,{method:'PATCH',headers:{...userHeaders(adminToken),Prefer:'return=minimal'},body:JSON.stringify({status:'valid',verified_by:adminId,verified_at:now})},'validate all docs')
  await jsonRequest(`${BASE}/rest/v1/berkas_seminar?pendaftaran_id=eq.${registrationId}&jenis_berkas=eq.persetujuan_ta`,{method:'PATCH',headers:{...userHeaders(adminToken),Prefer:'return=minimal'},body:JSON.stringify({status:'perbaikan',catatan_verifikator:'Ganti halaman persetujuan dengan versi terbaru',verified_by:null,verified_at:null})},'mark one correction')
  await jsonRequest(`${BASE}/rest/v1/pendaftaran_seminar?id=eq.${registrationId}`,{method:'PATCH',headers:{...userHeaders(adminToken),Prefer:'return=minimal'},body:JSON.stringify({status:'perbaikan',catatan_verifikator:'Mohon perbaiki berkas yang ditandai.',revision_requested_at:now})},'request revision')
  const visible=await jsonRequest(`${BASE}/rest/v1/berkas_seminar?pendaftaran_id=eq.${registrationId}&status=eq.perbaikan&select=id,catatan_verifikator`,{headers:{apikey:PUBLIC_KEY,Authorization:`Bearer ${studentToken}`}},'student sees correction')
  if(visible.length!==1)throw new Error(`Student correction visibility invalid: ${visible.length}`)
}

async function studentRevision(){
  const revised=await uploadDoc('persetujuan_ta','Halaman Persetujuan Tugas Akhir')
  if(!revised.file_id)throw new Error('Revision upload file id missing')
  const reg=await jsonRequest(`${BASE}/rest/v1/pendaftaran_seminar?id=eq.${registrationId}&select=status,revision_submitted_at`,{headers:{apikey:PUBLIC_KEY,Authorization:`Bearer ${studentToken}`}},'read revised registration')
  if(reg?.[0]?.status!=='diajukan')throw new Error(`Parent status setelah revisi: ${reg?.[0]?.status}`)
}

async function staffCompletes(){
  const now=new Date().toISOString()
  await jsonRequest(`${BASE}/rest/v1/berkas_seminar?pendaftaran_id=eq.${registrationId}&jenis_berkas=eq.persetujuan_ta`,{method:'PATCH',headers:{...userHeaders(adminToken),Prefer:'return=minimal'},body:JSON.stringify({status:'valid',catatan_verifikator:null,verified_by:adminId,verified_at:now})},'validate revision')
  const valid=await jsonRequest(`${BASE}/rest/v1/berkas_seminar?pendaftaran_id=eq.${registrationId}&status=eq.valid&select=id`,{headers:{apikey:PUBLIC_KEY,Authorization:`Bearer ${adminToken}`}},'count valid docs')
  if(valid.length!==10)throw new Error(`Valid docs ${valid.length}/10`)
  await jsonRequest(`${BASE}/rest/v1/pendaftaran_seminar?id=eq.${registrationId}`,{method:'PATCH',headers:{...userHeaders(adminToken),Prefer:'return=minimal'},body:JSON.stringify({status:'lengkap',catatan_verifikator:'Berkas dinyatakan lengkap.',verified_by:adminId,verified_at:now,completed_at:now})},'mark complete')
  const final=await jsonRequest(`${BASE}/rest/v1/pendaftaran_seminar?id=eq.${registrationId}&select=status,completed_at,catatan_verifikator`,{headers:{apikey:PUBLIC_KEY,Authorization:`Bearer ${studentToken}`}},'student sees final')
  if(final?.[0]?.status!=='lengkap'||!final?.[0]?.completed_at)throw new Error(`Final status invalid: ${JSON.stringify(final)}`)
}

async function announcementCycle(){
  const today=new Date().toISOString().slice(0,10)
  const rows=await jsonRequest(`${BASE}/rest/v1/pengumuman`,{method:'POST',headers:{...userHeaders(adminToken),Prefer:'return=representation'},body:JSON.stringify({judul:'E2E Informasi Akademik',isi:'Informasi uji sementara SIMASI',tanggal:today,is_active:true,created_by:adminId})},'create announcement')
  announcementId=rows?.[0]?.id
  if(!announcementId)throw new Error('Announcement ID missing')
  const publicRows=await jsonRequest(`${BASE}/rest/v1/pengumuman?id=eq.${announcementId}&select=id,judul`,{headers:{apikey:PUBLIC_KEY}},'anonymous announcement read')
  if(publicRows.length!==1)throw new Error('Active announcement tidak tampil publik')
  await jsonRequest(`${BASE}/rest/v1/pengumuman?id=eq.${announcementId}`,{method:'PATCH',headers:{...userHeaders(adminToken),Prefer:'return=minimal'},body:JSON.stringify({is_active:false})},'hide announcement')
  const hidden=await jsonRequest(`${BASE}/rest/v1/pengumuman?id=eq.${announcementId}&select=id`,{headers:{apikey:PUBLIC_KEY}},'anonymous hidden announcement read')
  if(hidden.length!==0)throw new Error('Inactive announcement masih tampil publik')
}

async function googleAccessToken(){
  const body=new URLSearchParams({client_id:process.env.GOOGLE_OAUTH_CLIENT_ID,client_secret:process.env.GOOGLE_OAUTH_CLIENT_SECRET,refresh_token:process.env.GOOGLE_OAUTH_REFRESH_TOKEN,grant_type:'refresh_token'})
  const data=await jsonRequest('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body},'Google token refresh')
  return data.access_token
}
async function cleanup(){
  try{
    if(driveFileIds.length){const token=await googleAccessToken();for(const id of [...new Set(driveFileIds)])await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?supportsAllDrives=true`,{method:'DELETE',headers:{Authorization:`Bearer ${token}`}})}
  }catch(e){console.warn(`Drive cleanup warning: ${e.message}`)}
  const h=SERVICE_KEY?serviceHeaders():null
  if(h){
    if(announcementId)await fetch(`${BASE}/rest/v1/pengumuman?id=eq.${announcementId}`,{method:'DELETE',headers:h})
    if(registrationId)await fetch(`${BASE}/rest/v1/pendaftaran_seminar?id=eq.${registrationId}`,{method:'DELETE',headers:h})
    if(nim)await fetch(`${BASE}/rest/v1/mahasiswa?nim=eq.${nim}`,{method:'DELETE',headers:h})
    if(studentId)await fetch(`${BASE}/auth/v1/admin/users/${studentId}`,{method:'DELETE',headers:h})
    if(adminId)await fetch(`${BASE}/auth/v1/admin/users/${adminId}`,{method:'DELETE',headers:h})
  }
}

let passed=false
try{
  console.log('1/9 Resolve keys')
  await resolveKeys()
  console.log('2/9 Admin Auth REST')
  await createAdmin()
  console.log('3/9 Import + student password lifecycle + fresh session')
  await createStudent()
  console.log('4/9 Create registration through student RLS')
  await createRegistration()
  console.log('5/9 Upload 10 PDFs + persist metadata')
  const docs=await uploadAll()
  console.log('6/9 Secure restricted Drive preview')
  await previewFirst(docs)
  console.log('7/9 Staff verification + request revision')
  await staffRequestsRevision()
  console.log('8/9 Student revision + final Berkas Lengkap')
  await studentRevision(); await staffCompletes()
  console.log('9/9 Informasi Akademik CRUD/public visibility')
  await announcementCycle()
  passed=true
  console.log('SIMASI_SEMINAR_LIFECYCLE_E2E=PASS')
}finally{
  await cleanup()
}
if(!passed)process.exitCode=1
