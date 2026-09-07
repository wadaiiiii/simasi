const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''
const SUPABASE_PUBLIC_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const hasSupabaseConfiguration = Boolean(
  SUPABASE_URL &&
  SUPABASE_PUBLIC_KEY &&
  !SUPABASE_URL.includes('YOUR_PROJECT') &&
  !SUPABASE_PUBLIC_KEY.includes('YOUR_SUPABASE')
)

export const supabaseClient = hasSupabaseConfiguration && window.supabase
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  : null

// Muat enhancement setelah DOM siap agar listener bawaan SIMASI sudah terpasang.
// Dynamic import ini sengaja diletakkan di sini supaya index.html tetap sederhana.
if (typeof window !== 'undefined') {
  const bootEnhancements = () => import('./enhancements.js').catch((error) => console.error('SIMASI enhancements gagal dimuat:', error))
  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', bootEnhancements, { once: true })
  else queueMicrotask(bootEnhancements)
}
