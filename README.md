# SIMASI

**Sistem Informasi Manajemen Kuliah dan Skripsi** untuk FMIPA Universitas Sulawesi Barat.

Stack:
- Vite + Vanilla JavaScript
- Tailwind CSS via CDN
- Supabase Auth + PostgreSQL + Storage
- GitHub
- Vercel

## Fitur MVP

- SPA tanpa reload halaman
- Dashboard statistik dan pengumuman
- Validasi syarat skripsi (>=110 SKS + Metode Penelitian)
- Pengajuan judul skripsi
- Pendaftaran Seminar & Tugas Akhir dua tahap
- Prodi: Matematika, Statistika, Aktuaria, Bioteknologi
- Upload/URL dokumen persyaratan
- Dokumen kondisional Ujian Tutup Skripsi
- Logbook bimbingan
- Laporan dan rekap nilai
- Export CSV dan print/PDF
- Supabase Auth
- Role mahasiswa/dosen/admin
- Row Level Security
- Mode Demo bila Supabase belum dikonfigurasi

## Jalankan Lokal

```bash
npm install
npm run dev
```

## Konfigurasi Supabase

Untuk pengguna di Indonesia, gunakan region terdekat yang tersedia, misalnya Southeast Asia (Singapore).

Urutan setup yang direkomendasikan:

1. Buat project Supabase.
2. Jalankan `supabase/schema.sql` melalui SQL Editor.
3. Jalankan `supabase/security_patch.sql` untuk hardening hak akses.
4. Opsional: jalankan `supabase/seed.sql` untuk data demo awal.
5. Tambahkan environment variable ke Vercel:

```env
VITE_SUPABASE_URL=https://PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_OR_PUBLISHABLE_KEY
```

Panduan rinci tersedia di `SUPABASE_SETUP.md`.

Jangan pernah memasukkan `service_role`, secret key, database password, atau access token ke frontend/GitHub.

## Role

User baru otomatis mendapat role `mahasiswa`. Ubah akun staff hanya melalui SQL/admin tooling terpercaya:

```sql
update public.profiles set role = 'dosen' where email = 'dosen@unsulbar.ac.id';
update public.profiles set role = 'admin' where email = 'admin@unsulbar.ac.id';
```

`security_patch.sql` membatasi update profil dari browser agar user biasa tidak dapat menaikkan role sendiri.

## Vercel

Hubungkan repository GitHub `wadaiiiii/simasi` ke project Vercel SIMASI dengan production branch `main`, lalu tambahkan:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

untuk Production dan Preview.

## Storage

`schema.sql` membuat bucket private `seminar-documents` dengan batas 10 MB untuk PDF/JPEG/PNG.

## Keamanan

- RLS aktif pada tabel akademik.
- Storage seminar bersifat private.
- Mahasiswa hanya mengakses data miliknya.
- Dosen/Admin memiliki akses sesuai role.
- Role tidak dapat dinaikkan sendiri dari browser setelah `security_patch.sql` dijalankan.
- Catatan dosen dan status approval logbook dilindungi dari update mahasiswa.
- Dashboard memakai RPC agregat agar data mahasiswa tidak dibuka sebagai tabel publik.

## Mode Demo

Tanpa environment variable Supabase, aplikasi otomatis memakai data demo agar UI tetap dapat diuji di Vercel.
