# SIMASI Laravel

**Sistem Informasi Manajemen Kuliah dan Skripsi** — FMIPA Universitas Sulawesi Barat.

## Stack
- Laravel 13 / PHP 8.3+
- Blade + CSS mobile-first
- Supabase Auth
- Supabase PostgreSQL melalui Data API + RLS
- Supabase Storage untuk dokumen seminar
- Hosting target: cPanel/PHP hosting, Railway/Render, Laravel Cloud, atau VPS

## Alur keamanan
Browser/HP → Laravel → Supabase. Browser tidak melakukan CRUD langsung ke Supabase. Laravel menyimpan access/refresh token Supabase di encrypted server session. RLS Supabase tetap aktif sebagai defense-in-depth.

## Menjalankan lokal
```bash
composer install
cp .env.example .env
php artisan key:generate
php artisan serve
```
Lalu isi `SUPABASE_URL` dan `SUPABASE_PUBLISHABLE_KEY` di `.env`.

## Modul MVP
- Login Supabase Auth melalui backend Laravel
- Dashboard dan pengumuman
- Cek kelayakan skripsi ≥110 SKS + lulus Metode Penelitian
- Pengajuan skripsi
- Pendaftaran Seminar Proposal / Ujian Tutup
- Upload file atau URL untuk 10+2 persyaratan
- Logbook bimbingan
- Laporan dan nilai
- Role mahasiswa/dosen/admin dari `profiles.role`
- UI mobile-first + bottom navigation

## Catatan data mahasiswa
Akun Auth perlu ditautkan ke `public.mahasiswa.user_id` agar mahasiswa dapat melihat status akademiknya. Role disimpan di `public.profiles.role` dan hanya boleh dipromosikan melalui admin/SQL terpercaya.

## cPanel
Document Root harus mengarah ke folder `public/`. Jika tidak bisa mengubah Document Root, gunakan subdomain/directory terpisah yang root-nya menunjuk ke `<project>/public`.
