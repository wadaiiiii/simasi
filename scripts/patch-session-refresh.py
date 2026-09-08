from pathlib import Path

p = Path('src/app-v5.js')
s = p.read_text()
old = '''async function init(){
  document.addEventListener('click',handleClick);document.addEventListener('change',handleChange);document.addEventListener('input',handleInput);document.addEventListener('submit',handleSubmit);window.addEventListener('pointermove',handlePointerMove,{passive:true})
  await refreshSession()
  if(hasSupabaseConfiguration){supabaseClient.auth.onAuthStateChange((event,session)=>{if(event==='PASSWORD_RECOVERY'){state.user=session?.user||state.user;setTimeout(async()=>{await refreshSession();state.page=initialPrivatePage();await renderPrivate();openPasswordModal(true)},0)}})}
  await renderLanding()
}

init()'''
new = '''async function init(){
  document.addEventListener('click',handleClick);document.addEventListener('change',handleChange);document.addEventListener('input',handleInput);document.addEventListener('submit',handleSubmit);window.addEventListener('pointermove',handlePointerMove,{passive:true})

  // Restore persisted Supabase session before deciding which UI to render.
  // Previously SIMASI always rendered the public landing page after refreshSession(),
  // which made an active session look as if it had been logged out on reload.
  await refreshSession()

  if(hasSupabaseConfiguration){
    supabaseClient.auth.onAuthStateChange((event,session)=>{
      if(event==='PASSWORD_RECOVERY'){
        state.user=session?.user||state.user
        setTimeout(async()=>{await refreshSession();state.page=initialPrivatePage();await renderPrivate();openPasswordModal(true)},0)
        return
      }
      if(event==='SIGNED_OUT'){
        setTimeout(async()=>{state.user=null;state.profile=null;state.page='landing';await renderLanding()},0)
        return
      }
      if(['SIGNED_IN','TOKEN_REFRESHED','USER_UPDATED'].includes(event)){
        setTimeout(async()=>{
          await refreshSession()
          if(state.user&&state.page==='landing'){
            state.page=initialPrivatePage()
            await renderPrivate()
          }
        },0)
      }
    })
  }

  if(state.user){
    state.page=initialPrivatePage()
    await renderPrivate()
  }else{
    await renderLanding()
  }
}

init()'''
if old not in s:
    raise SystemExit('init anchor not found; inspect src/app-v5.js before patching')
s = s.replace(old, new)
p.write_text(s)
print('Session refresh persistence patch applied')
