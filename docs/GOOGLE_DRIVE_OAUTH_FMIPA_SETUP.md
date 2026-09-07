# SIMASI — Google Drive OAuth akun FMIPA

SIMASI menggunakan OAuth akun `fmipa@unsulbar.ac.id` agar berkas mahasiswa tetap masuk ke folder My Drive SIMASI dan memakai kuota akun FMIPA.

Folder root produksi:

- Folder: `SIMASI`
- Folder ID: `19Pi-nie5ODUBDeoPcnEMGVu-wkiPDwrv`

## Penting tentang izin

Backend menggunakan scope `https://www.googleapis.com/auth/drive` karena folder SIMASI sudah ada dan direferensikan langsung melalui folder ID. Token OAuth secara teknis memiliki hak sesuai scope Drive pada akun FMIPA. Kode SIMASI sendiri hanya bekerja dari `GOOGLE_DRIVE_ROOT_FOLDER_ID` dan membuat subfolder di bawah root tersebut.

Jika nanti ingin izin Google yang benar-benar granular hanya ke satu folder, migrasikan bootstrap ke Google Picker + scope `drive.file`.

## 1. OAuth consent screen

Di Google Cloud project yang Google Drive API-nya sudah aktif:

1. Buka **APIs & Services → OAuth consent screen**.
2. Jika akun Google Workspace Unsulbar menyediakan opsi **Internal**, gunakan Internal.
3. Nama aplikasi: `SIMASI FMIPA`.
4. Isi email support/developer dengan akun institusi yang sesuai.
5. Pastikan akun `fmipa@unsulbar.ac.id` dapat memberikan consent.

Hindari membiarkan aplikasi external dalam status Testing untuk produksi, karena refresh token testing dapat memiliki masa berlaku terbatas.

## 2. Buat OAuth Client

Buka **APIs & Services → Credentials → Create credentials → OAuth client ID**.

Gunakan:

- Application type: **Web application**
- Name: `SIMASI Google Drive Backend`
- Authorized redirect URI:
  `https://developers.google.com/oauthplayground`

Simpan:

- Client ID
- Client Secret

Jangan commit atau kirim nilainya ke chat.

## 3. Buat refresh token via OAuth Playground

Buka Google OAuth 2.0 Playground.

Pada ikon gear / OAuth 2.0 Configuration:

- OAuth flow: Server-side
- Access type: Offline
- Force prompt: Consent Screen
- centang **Use your own OAuth credentials**
- isi Client ID dan Client Secret milik `SIMASI Google Drive Backend`

Pada Step 1, masukkan scope:

`https://www.googleapis.com/auth/drive`

Klik **Authorize APIs**, lalu login/consent menggunakan `fmipa@unsulbar.ac.id`.

Pada Step 2 klik **Exchange authorization code for tokens**.

Simpan nilai `Refresh token`.

## 4. GitHub Repository Secrets

Repo: `wadaiiiii/simasi`

Settings → Secrets and variables → Actions → Repository secrets.

Tambahkan:

- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `GOOGLE_OAUTH_REFRESH_TOKEN`

Secret lama service account boleh disimpan sementara tetapi tidak lagi dipakai oleh workflow produksi.

## 5. Deploy

Jalankan workflow:

`Supabase Backend Release (Manual)`

Input:

- `apply_database = false` jika migration sebelumnya sudah berhasil
- `configure_google_drive = true`

Workflow akan:

1. memvalidasi refresh token,
2. memverifikasi akses tulis akun FMIPA ke folder SIMASI,
3. memasang OAuth secret ke Supabase,
4. redeploy Edge Functions,
5. menampilkan daftar function terpasang.

## 6. Uji end-to-end

Setelah release sukses, jalankan smoke test SIMASI:

- import mahasiswa,
- login NIM / password awal NIM,
- wajib ganti password,
- pendaftaran Seminar Proposal,
- upload PDF maksimal 2 MB,
- file masuk ke My Drive `SIMASI`,
- metadata Google Drive tersimpan di Supabase.
