# SIMASI Laravel Architecture

## Target Architecture

- Backend utama: Laravel (monolith/API)
- UI: Blade + Tailwind CSS + Alpine.js, mobile-first
- Database: Supabase PostgreSQL
- File storage: Supabase Storage
- Source control: GitHub
- Authentication/authorization: Laravel session/Sanctum + role mahasiswa/dosen/admin
- Deployment backend: PHP-compatible hosting (cPanel/Railway/Render/VPS). Vercel tidak dijadikan runtime utama Laravel.

## Request Flow

Browser/mobile -> Laravel -> Supabase PostgreSQL / Storage

Browser tidak melakukan CRUD langsung ke Supabase. Semua validasi akademik, role, workflow seminar, nilai, logbook, dan audit ditangani Laravel.

## Domain Modules

1. Dashboard
2. Manajemen Kuliah / kelayakan skripsi
3. Pengajuan Skripsi
4. Pendaftaran Seminar & Tugas Akhir
5. Logbook Bimbingan
6. Laporan & Nilai
7. Manajemen Pengguna dan Role
8. Pengumuman

## Mobile-first Rules

- Sidebar berubah menjadi drawer/bottom navigation pada layar kecil
- Tabel desktop berubah menjadi card list pada mobile
- Form satu kolom pada mobile, dua kolom hanya mulai breakpoint tablet
- Tombol aksi minimum tinggi 44px
- Upload berkas mendukung kamera/file picker mobile
- Tidak ada horizontal scroll untuk alur utama
- Dashboard menggunakan kartu ringkas dan CTA besar

## Supabase Usage

Supabase dipakai sebagai PostgreSQL managed database dan Storage. Schema SIMASI yang sudah dibuat tetap dipakai. Laravel menjadi trusted application layer di atasnya.

## Security

- Secret/service credentials hanya ada di environment backend Laravel
- Browser tidak menerima secret key
- Validasi role dilakukan di middleware/policies Laravel
- RLS Supabase tetap dipertahankan sebagai defense-in-depth
- Upload dokumen divalidasi MIME, ukuran, dan ownership
- Audit log untuk perubahan status seminar, nilai, dan role

## Recommended Laravel Structure

app/
- Models/
- Http/Controllers/
- Http/Requests/
- Policies/
- Services/SupabaseStorageService.php
- Services/AcademicEligibilityService.php
- Services/SeminarRegistrationService.php

resources/views/
- layouts/app.blade.php
- dashboard/
- kuliah/
- skripsi/
- seminar/
- logbook/
- laporan/
- auth/

routes/
- web.php
- api.php

## Deployment Decision

Laravel backend sebaiknya ditempatkan pada hosting PHP yang mendukung worker, cron, queue, storage symlink, dan konfigurasi environment dengan baik. Vercel tetap dapat digunakan untuk aset/static frontend atau preview terpisah, tetapi bukan runtime utama aplikasi Laravel.
