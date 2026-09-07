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

    // Perubahan password dapat membatalkan session_id lama. Ambil sesi baru
    // agar Edge Function upload tidak menerima JWT yang sudah invalid (401).
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

document.addEventListener('submit',savePasswordWithFreshSession,true)
document.addEventListener('change',restoreRoleUpdate,true)
document.addEventListener('click',ensureStudentDetailState,true)
