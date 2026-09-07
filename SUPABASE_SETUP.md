# Setup Supabase untuk SIMASI

## Project
- Project ref: `jdptpfpmelmaviucaioq`
- Region: Southeast Asia (Singapore)

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
Tambahkan pada Production dan Preview:

```text
VITE_SUPABASE_URL=<Project URL Supabase>
VITE_SUPABASE_PUBLISHABLE_KEY=<Publishable key Supabase>
```

Frontend masih menerima `VITE_SUPABASE_ANON_KEY` sebagai fallback deployment lama. Jangan pernah menyimpan service role, secret key, database password, service-account private key, atau access token di frontend/repository.

## Edge Functions
Tiga fungsi produksi:

```text
import-mahasiswa
change-initial-password
upload-seminar-drive
```

Deployment disiapkan lewat workflow manual:

```text
.github/workflows/supabase-release-manual.yml
```

Workflow hanya berjalan saat dipicu manual dari GitHub Actions, sehingga tidak melakukan deploy pada setiap commit.

## Import mahasiswa
Function `import-mahasiswa` hanya menerima caller role `admin`.

Data yang digunakan:
- NIM
- Nama
- Program Studi

Akun baru:
- username UI: NIM;
- password awal: NIM;
- email internal: `<nim>@students.simasi.local`;
- `must_change_password=true`;
- setelah login pertama pengguna wajib mengganti password minimal 8 karakter dan tidak boleh sama dengan NIM.

Import ulang tidak mereset password mahasiswa yang sudah memiliki akun.

## Google Drive — service account khusus SIMASI
Folder induk permanen:

```text
Folder ID: 19Pi-nie5ODUBDeoPcnEMGVu-wkiPDwrv
```

SIMASI hanya menggunakan service account khusus. OAuth akun utama FMIPA tidak dipakai.

Struktur otomatis:

```text
SIMASI/
└── <Program Studi>/
    └── <NIM> - <Nama>/
        ├── Seminar Proposal/
        │   └── YYYY-MM-DD_<id-pendaftaran>/
        └── Seminar Hasil/
            └── YYYY-MM-DD_<id-pendaftaran>/
```

Google Drive root harus diubah menjadi **Restricted**, kemudian share hanya folder SIMASI tersebut kepada email service account sebagai **Editor**. Folder Drive lain tidak perlu dibagikan.

Secrets backend:

```text
GOOGLE_SERVICE_ACCOUNT_EMAIL
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
GOOGLE_DRIVE_ROOT_FOLDER_ID=19Pi-nie5ODUBDeoPcnEMGVu-wkiPDwrv
```

Service account meminta scope Google Drive API, tetapi scope tersebut tetap tunduk pada permission Drive service account. Karena yang dibagikan hanya folder SIMASI, folder pribadi lain tidak otomatis dapat diakses.

## Berkas seminar
Aturan produksi:

```text
Format: PDF saja
Ukuran: maksimal 2 MB per file
Jenis: Seminar Proposal / Seminar Hasil
```

Function `upload-seminar-drive` memverifikasi bahwa service account dapat menambahkan file ke folder root SIMASI sebelum membuat struktur subfolder dan upload dokumen.

## GitHub Actions Secrets
Repository `wadaiiiii/simasi` membutuhkan secrets berikut untuk workflow backend:

```text
SUPABASE_ACCESS_TOKEN
SUPABASE_DB_URL
GOOGLE_SERVICE_ACCOUNT_EMAIL
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
```

Jangan kirim nilai secret tersebut ke chat dan jangan commit ke repository.

## Auth dan role
Role `dosen` atau `admin` hanya dipromosikan melalui SQL/admin tooling terpercaya:

```sql
update public.profiles set role='dosen' where email='dosen@unsulbar.ac.id';
update public.profiles set role='admin' where email='admin@unsulbar.ac.id';
```

## Verifikasi end-to-end
1. Jalankan workflow **Supabase Backend Release (Manual)** dengan `apply_database=true` dan `configure_google_drive=true`.
2. Pastikan tiga Edge Function terdaftar.
3. Login admin dan import satu data mahasiswa.
4. Pastikan akun mahasiswa login dengan NIM + password NIM.
5. Pastikan mahasiswa wajib mengganti password.
6. Login ulang dengan password baru.
7. Daftar Seminar Proposal/Seminar Hasil.
8. Upload PDF < 2 MB.
9. Pastikan file masuk ke folder Drive SIMASI pada struktur Program Studi/NIM/Jenis Seminar.
10. Pastikan `berkas_seminar` menyimpan `storage_provider='google_drive'`, `drive_file_id`, `drive_folder_id`, dan link file.
