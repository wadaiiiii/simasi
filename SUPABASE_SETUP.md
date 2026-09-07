# Setup Supabase untuk SIMASI

## Project
- Nama yang disarankan: `simasi-fmipa`
- Region yang disarankan untuk pengguna Indonesia: Southeast Asia (Singapore)

## Urutan SQL
Jalankan melalui Supabase SQL Editor secara berurutan:

1. `supabase/schema.sql`
2. `supabase/security_patch.sql`
3. `supabase/seed.sql` (opsional untuk data demo)

## Environment Variables Vercel
Tambahkan ke project Vercel SIMASI pada Production dan Preview:

```text
VITE_SUPABASE_URL=<Project URL Supabase>
VITE_SUPABASE_ANON_KEY=<Publishable/anon key Supabase>
```

Jangan pernah memasukkan `service_role`, secret key, database password, atau access token ke repository/frontend.

## Auth
User baru otomatis dibuatkan baris `profiles` dengan role `mahasiswa`.

Role `dosen` atau `admin` hanya dipromosikan lewat SQL/admin tooling terpercaya:

```sql
update public.profiles set role='dosen' where email='dosen@unsulbar.ac.id';
update public.profiles set role='admin' where email='admin@unsulbar.ac.id';
```

## Storage
Bucket private `seminar-documents` dibuat oleh `schema.sql` dengan batas 10 MB dan tipe PDF/JPEG/PNG.

## Verifikasi setelah setup
1. Pastikan tabel `profiles`, `mahasiswa`, `pengumuman`, `pengajuan_skripsi`, `logbook_bimbingan`, `pendaftaran_seminar`, `berkas_seminar`, dan `nilai_skripsi` tersedia.
2. Pastikan RLS aktif pada tabel-tabel tersebut.
3. Pastikan bucket `seminar-documents` tersedia dan private.
4. Buat akun mahasiswa untuk pengujian.
5. Pastikan mahasiswa tidak dapat mengubah field `role` sendiri.
6. Pastikan mahasiswa hanya melihat data miliknya.
7. Pastikan upload berkas seminar masuk ke folder `{auth.uid()}/...`.
