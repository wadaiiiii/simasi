# Setup Satu Kali: Manual Vercel Release

Automatic Vercel Git deployments sudah dinonaktifkan. Dua workflow manual tersedia di branch `main`:

- `Vercel Preview - Manual`
- `Vercel Promote - Manual`

## GitHub Secrets yang dibutuhkan
Buka repository GitHub -> Settings -> Secrets and variables -> Actions -> New repository secret.

Tambahkan:

1. `VERCEL_TOKEN`
2. `VERCEL_ORG_ID`
3. `VERCEL_PROJECT_ID`

Jangan commit nilai secret ke repository.

## Cara Preview
GitHub -> Actions -> `Vercel Preview - Manual` -> Run workflow.

Default ref adalah `main`. Workflow akan build satu kali dan mengirim output prebuilt ke Vercel.

## Cara Production tanpa Build Kedua
Setelah preview diuji dan dinyatakan siap:

GitHub -> Actions -> `Vercel Promote - Manual` -> Run workflow -> masukkan URL preview.

Workflow menjalankan `vercel promote`, sehingga deployment preview yang sama dipakai sebagai production tanpa membuat build kedua.

## Aturan SIMASI
- Tidak deploy untuk setiap commit.
- CI GitHub tetap berjalan normal.
- Batch perubahan sebelum preview.
- Preview hanya untuk demo/QA/milestone.
- Backend Laravel tetap ditempatkan di hosting PHP-compatible, bukan runtime PHP native Vercel.
