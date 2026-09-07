# SIMASI Production Domain

Canonical public URL:

https://simasimipa.vercel.app

## Deployment rule

- `simasimipa.vercel.app` adalah URL publik utama SIMASI.
- URL deployment acak Vercel (`*-<hash>-*.vercel.app`) hanya untuk inspeksi/preview dan tidak dibagikan ke pengguna.
- Automatic Git deployment tetap dinonaktifkan untuk menghemat kuota Vercel Hobby.
- Vercel dipakai sebagai public entry/preview layer.
- Laravel berjalan pada hosting PHP dan nantinya dapat diproxy/rewrite melalui domain publik Vercel agar pengguna tetap mengakses `simasimipa.vercel.app`.
- Production promotion dilakukan hanya setelah CI dan QA lulus.

## Supabase Auth

Saat production aktif, Site URL / redirect utama Supabase Auth harus diarahkan ke:

https://simasimipa.vercel.app
