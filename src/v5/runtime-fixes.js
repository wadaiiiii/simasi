import { state, supabaseClient, refreshSession, loading, toast, edge } from '../v4/core.js'
import { loadUsers } from '../v4/data.js'
import { loadStudentApplications, openStudentApplication } from './workflow.js'

function passwordMessage(text, error=true){
  const msg=document.querySelector('#passwordMsg')
  if(!msg)return
  msg.textContent=text
  msg.className=`rounded-xl border p-3 text-sm ${error?'border-rose-200 bg-rose-50 text-rose-700':'border-emerald-200 bg-emerald-50 text-emerald-700'}`
  msg.classList.remove('hidden')
}

async function savePasswordWithFreshSession(event){
  const form=event.target
  if(form?.id!=='passwordForm')return
  event.preventDefault()
  event.stopImmediatePropagation()

  const password=document.querySelector('#newPassword')?.value||''
  const confirmation=document.querySelector('#newPassword2')?.value||''
  if(password.length<8)return passwordMessage('Password minimal 8 karakter.')
  if(password!==confirmation)return passwordMessage('Konfirmasi password tidak sama.')

  const email=state.user?.email
  if(!email)return passwordMessage('Email akun tidak tersedia. Silakan login ulang.')

  loading(true,'Menyimpan password dan memperbarui sesi...')
  try{
    if(state.recovery){
      const result=await supabaseClient.auth.updateUser({password})
      if(result.error)throw result.error
    }else{
      await edge('change-initial-password',{new_password:password})
    }

    // Perubahan password membatalkan session_id lama pada Auth. Ambil token baru
    // sebelum layanan seminar/Edge Function digunakan lagi.
    const login=await supabaseClient.auth.signInWithPassword({email,password})
    if(login.error)throw new Error(`Password tersimpan, tetapi sesi baru gagal dibuat: ${login.error.message}`)
    await refreshSession()
    state.profile={...state.profile,must_change_password:false}
    state.recovery=false
    passwordMessage('Password berhasil diperbarui dan sesi baru sudah aktif.',false)
    toast('Password baru aktif. Anda tetap login dengan sesi yang baru.')
    setTimeout(()=>{
      const modal=document.querySelector('#passwordModal')
      modal?.classList.add('hidden')
      modal?.classList.remove('flex')
    },650)
  }catch(error){
    passwordMessage(error?.message||'Gagal mengganti password.')
  }finally{
    loading(false)
  }
}

async function restoreRoleUpdate(event){
  const target=event.target
  if(!target?.matches?.('[data-action="set-role"]'))return
  const userId=target.dataset.id
  const nextRole=target.value
  if(!userId||!nextRole)return
  loading(true,'Memperbarui role user...')
  try{
    await edge('admin-users',{action:'set_role',user_id:userId,role:nextRole})
    toast('Role user diperbarui.')
    await loadUsers()
  }catch(error){
    toast(error?.message||'Gagal mengubah role user.','err')
    await loadUsers()
  }finally{
    loading(false)
  }
}

async function ensureStudentDetailState(event){
  const button=event.target?.closest?.('[data-action="student-application-detail"]')
  if(!button||state.studentApplications.length)return
  event.preventDefault()
  event.stopImmediatePropagation()
  loading(true,'Memuat detail pengajuan...')
  try{
    await loadStudentApplications()
    openStudentApplication(button.dataset.id)
  }finally{
    loading(false)
  }
}

function showSecurePdf(blob,title='Preview Berkas'){
  document.querySelector('#pdfPreviewModal')?.remove()
  const url=URL.createObjectURL(blob)
  const wrap=document.createElement('div')
  wrap.id='pdfPreviewModal'
  wrap.dataset.revoke='true'
  wrap.dataset.url=url
  wrap.className='fixed inset-0 z-[1000] flex flex-col bg-slate-950/80 p-3 backdrop-blur-sm'
  wrap.innerHTML=`<div class="mx-auto flex w-full max-w-5xl items-center justify-between rounded-t-2xl bg-white px-4 py-3"><p class="min-w-0 truncate text-sm font-extrabold"></p><div class="flex gap-2"><a target="_blank" rel="noopener" class="rounded-xl border px-3 py-2 text-xs font-bold">Buka Tab Baru</a><button data-action="close-pdf-preview" class="rounded-xl border px-3 py-2">✕</button></div></div><iframe class="mx-auto h-full min-h-0 w-full max-w-5xl rounded-b-2xl bg-white" title="Preview PDF"></iframe>`
  wrap.querySelector('p').textContent=title
  wrap.querySelector('a').href=url
  wrap.querySelector('iframe').src=url
  document.body.appendChild(wrap)
}

async function secureStoredPreview(event){
  const button=event.target?.closest?.('[data-action="preview-remote-doc"]')
  if(!button)return
  event.preventDefault()
  event.stopImmediatePropagation()

  const directUrl=button.dataset.url||''
  let doc=state.docs.find(item=>item.file_url===directUrl)
  if(!doc&&button.dataset.id)doc=state.docs.find(item=>item.id===button.dataset.id)
  if(!doc?.id){
    toast('Metadata berkas belum tersedia untuk preview aman.','info')
    return
  }

  loading(true,'Membuka preview PDF...')
  try{
    const {data,error}=await supabaseClient.functions.invoke('preview-seminar-drive',{body:{document_id:doc.id}})
    if(error){
      let message=error.message||'Preview berkas gagal.'
      try{const response=error.context;if(response?.clone){const detail=await response.clone().json();message=detail?.message||detail?.error||message}}catch{}
      throw new Error(message)
    }
    const blob=data instanceof Blob?data:new Blob([data],{type:'application/pdf'})
    showSecurePdf(blob,doc.nama_berkas||'Preview Berkas Seminar')
  }catch(error){
    toast(error?.message||'Preview berkas gagal.','err')
  }finally{
    loading(false)
  }
}

document.addEventListener('submit',savePasswordWithFreshSession,true)
document.addEventListener('change',restoreRoleUpdate,true)
document.addEventListener('click',ensureStudentDetailState,true)
document.addEventListener('click',secureStoredPreview,true)
