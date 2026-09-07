# Setup Supabase untuk SIMASI

## Project
- Nama yang disarankan: `simasi-fmipa`
- Region yang disarankan untuk pengguna Indonesia: Southeast Asia (Singapore)

## Urutan SQL
Jalankan melalui Supabase SQL Editor secara berurutan:

1. `supabase/schema.sql`
2. `supabase/security_patch.sql`
3. `supabase/student_import_drive.sql`
4. `supabase/seed.sql` (opsional untuk data demo)

`student_import_drive.sql` menambahkan:
- flag `profiles.must_change_password`;
- metadata penyimpanan Google Drive pada `berkas_seminar`;
- restrictive RLS agar mahasiswa yang masih memakai password awal belum dapat membuka data akademik sensitif;
- endpoint cek kelayakan skripsi menjadi authenticated-only dan hanya untuk data sendiri, kecuali dosen/admin.

## Environment Variables Vercel
Tambahkan ke project Vercel SIMASI pada Production dan Preview:

```text
VITE_SUPABASE_URL=<Project URL Supabase>
VITE_SUPABASE_PUBLISHABLE_KEY=<Publishable key Supabase>
```

Frontend masih menerima `VITE_SUPABASE_ANON_KEY` untuk kompatibilitas deployment lama, tetapi deployment baru sebaiknya memakai publishable key.

Jangan pernah memasukkan `service_role`, secret key, database password, Google OAuth secret, private key, atau access token ke repository/frontend.

## Edge Functions
Deploy tiga function berikut dari repository:

```bash
supabase functions deploy import-mahasiswa
supabase functions deploy change-initial-password
supabase functions deploy upload-seminar-drive
```

Function `import-mahasiswa` hanya menerima caller dengan role `admin`. Function membuat akun mahasiswa baru menggunakan identitas internal `<nim>@students.simasi.local`; pada UI mahasiswa tetap login menggunakan NIM.

Akun baru:
- username UI: NIM;
- password awal: NIM;
- email internal: `<nim>@students.simasi.local`;
- `must_change_password=true`;
- setelah login pertama pengguna wajib mengganti password minimal 8 karakter.

Import ulang tidak mereset password mahasiswa yang akunnya sudah tertaut; data Nama/Program Studi diperbarui tanpa mengubah password aktif.

## Google Drive sebagai penyimpanan berkas
Folder induk SIMASI:

```text
Folder ID: 19Pi-nie5ODUBDeoPcnEMGVu-wkiPDwrv
```

Struktur dibuat otomatis:

```text
SIMASI/
└── <Program Studi>/
    └── <NIM> - <Nama>/
        ├── Seminar Proposal/
        │   └── YYYY-MM-DD_<id-pendaftaran>/
        └── Seminar Hasil/
            └── YYYY-MM-DD_<id-pendaftaran>/
```

### Kredensial Google Drive yang disarankan
Untuk folder My Drive milik akun FMIPA, gunakan OAuth refresh token akun pemilik/pengelola folder agar file benar-benar dibuat atas akun Google Workspace yang memiliki kuota Drive.

Simpan hanya sebagai Supabase Edge Function secrets:

```bash
supabase secrets set GOOGLE_DRIVE_ROOT_FOLDER_ID=19Pi-nie5ODUBDeoPcnEMGVu-wkiPDwrv
supabase secrets set GOOGLE_OAUTH_CLIENT_ID=<oauth-client-id>
supabase secrets set GOOGLE_OAUTH_CLIENT_SECRET=<oauth-client-secret>
supabase secrets set GOOGLE_OAUTH_REFRESH_TOKEN=<offline-refresh-token>
```

Function juga mendukung fallback service account melalui:

```text
GOOGLE_SERVICE_ACCOUNT_EMAIL
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
```

Namun untuk folder My Drive biasa, OAuth akun Workspace lebih disarankan. Service account paling cocok bila tujuan berada pada Shared Drive atau dikonfigurasi dengan domain-wide delegation.

Ubah akses umum folder Drive menjadi **Restricted**. Backend Google OAuth yang diberi izin akan tetap dapat mengunggah file; mahasiswa tidak perlu memperoleh akses Editor ke folder induk.

## Auth dan role
User baru dari proses import otomatis menjadi `mahasiswa`.

Role `dosen` atau `admin` hanya dipromosikan lewat SQL/admin tooling terpercaya:

```sql
update public.profiles set role='dosen' where email='dosen@unsulbar.ac.id';
update public.profiles set role='admin' where email='admin@unsulbar.ac.id';
```

## Storage Supabase
Bucket private `seminar-documents` dari schema lama tetap dipertahankan sebagai kompatibilitas/backup. Alur frontend baru mengirim file seminar ke Edge Function `upload-seminar-drive`, lalu menyimpan `drive_file_id`, `drive_folder_id`, `webViewLink`, dan `storage_provider='google_drive'` pada database.

## Verifikasi setelah setup
1. Pastikan tabel `profiles`, `mahasiswa`, `pengumuman`, `pengajuan_skripsi`, `logbook_bimbingan`, `pendaftaran_seminar`, `berkas_seminar`, dan `nilai_skripsi` tersedia.
2. Pastikan kolom `profiles.must_change_password` tersedia.
3. Pastikan RLS aktif dan restrictive password gate terpasang pada tabel akademik mahasiswa.
4. Buat/promosikan satu akun admin untuk pengujian.
5. Login admin dan buka menu **Import Data Mahasiswa**.
6. Import Excel/PDF berisi kolom `NIM`, `Nama`, `Program Studi`.
7. Pastikan akun mahasiswa baru dapat login dengan NIM + password NIM.
8. Pastikan mahasiswa diarahkan mengganti password dan tidak dapat membuka layanan sensitif sebelum pergantian selesai.
9. Upload satu berkas seminar dan pastikan file masuk ke folder Google Drive SIMASI pada struktur prodi/NIM/jenis seminar.
10. Pastikan mahasiswa tidak dapat mengubah field `role` sendiri dan hanya melihat data miliknya.
