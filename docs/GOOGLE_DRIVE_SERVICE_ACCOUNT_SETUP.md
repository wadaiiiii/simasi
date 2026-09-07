# Google Drive Service Account — SIMASI

Tujuan: backend SIMASI hanya bekerja pada folder Google Drive `SIMASI`, tanpa menggunakan OAuth akun utama FMIPA.

## Folder produksi

```text
Nama: SIMASI
Folder ID: 19Pi-nie5ODUBDeoPcnEMGVu-wkiPDwrv
```

## 1. Buat project Google Cloud khusus SIMASI
1. Buka Google Cloud Console.
2. Buat/select project khusus, contoh `simasi-fmipa`.
3. Enable **Google Drive API**.

## 2. Buat service account
1. IAM & Admin → Service Accounts.
2. Create Service Account, contoh nama `simasi-storage`.
3. Tidak perlu memberikan role Google Cloud yang luas untuk mengakses file Drive.
4. Buka service account → Keys → Add Key → Create new key → JSON.

Dari JSON hanya dua nilai yang dibutuhkan backend:

```text
client_email  → GOOGLE_SERVICE_ACCOUNT_EMAIL
private_key   → GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
```

Jangan commit file JSON atau private key ke GitHub.

## 3. Batasi akses Drive ke satu folder
Pada Google Drive akun FMIPA:
1. Buka folder `SIMASI`.
2. Share folder hanya ke `client_email` service account sebagai **Editor**.
3. Ubah General access menjadi **Restricted**.
4. Jangan share folder Drive lain kepada service account.

Service account menggunakan scope API Google Drive, tetapi API tetap tunduk pada permission file/folder service account. Karena hanya folder SIMASI yang dibagikan, file/folder lain tidak otomatis dapat diakses.

## 4. GitHub Actions Secrets
Repository: `wadaiiiii/simasi`

Settings → Secrets and variables → Actions → New repository secret.

Tambahkan:

```text
GOOGLE_SERVICE_ACCOUNT_EMAIL=<client_email JSON>
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=<private_key JSON lengkap termasuk BEGIN/END PRIVATE KEY>
SUPABASE_ACCESS_TOKEN=<Supabase personal access token>
SUPABASE_DB_URL=<Postgres connection string project SIMASI>
```

Jangan mengirim nilai secret ke chat.

## 5. Deploy backend
GitHub → Actions → **Supabase Backend Release (Manual)** → Run workflow.

Pilih:

```text
apply_database = true
configure_google_drive = true
```

Workflow akan:
1. menjalankan `supabase/student_import_drive.sql`;
2. menguji service account secara read-only ke folder root SIMASI;
3. gagal jika service account tidak punya permission menambah file;
4. menyimpan credential sebagai Supabase Edge secrets;
5. deploy `import-mahasiswa`;
6. deploy `change-initial-password`;
7. deploy `upload-seminar-drive`;
8. menampilkan daftar Edge Function sebagai verifikasi.

## 6. Uji end-to-end
Gunakan satu mahasiswa uji:
1. Admin import NIM, Nama, Program Studi.
2. Login mahasiswa dengan NIM / NIM.
3. Ganti password wajib.
4. Pilih Seminar Proposal atau Seminar Hasil.
5. Upload PDF < 2 MB.
6. Pastikan Drive membuat struktur:

```text
SIMASI/<Program Studi>/<NIM> - <Nama>/<Jenis Seminar>/<Tanggal_ID>/
```

7. Pastikan database menyimpan `storage_provider=google_drive`, `drive_file_id`, `drive_folder_id`, dan URL file.

## Catatan keamanan
- OAuth akun `fmipa@unsulbar.ac.id` tidak digunakan oleh backend.
- Service-account JSON tidak pernah masuk repository.
- Vercel frontend tidak menerima service-account credential.
- File seminar dibatasi PDF maksimal 2 MB.
- Folder root diverifikasi setiap upload sebelum subfolder dibuat.
