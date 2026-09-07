# SIMASI Vercel Deployment Policy

## Tujuan
Menghemat kuota Hobby Vercel dan mencegah setiap commit pengembangan membuat deployment baru.

## Kebijakan
1. Automatic Git deployments dinonaktifkan melalui `vercel.json`.
2. Commit dan CI GitHub boleh berjalan sesering diperlukan; keduanya tidak dianggap deployment Vercel.
3. Vercel digunakan untuk frontend/static preview dan demo online.
4. Backend Laravel tidak dijalankan sebagai runtime utama di Vercel. Backend dideploy ke hosting PHP (cPanel/VPS/Railway/Render PHP-compatible) dan frontend Vercel mengakses Laravel melalui HTTPS API/web endpoint bila arsitektur dipisah.
5. Preview Vercel hanya dibuat setelah satu batch perubahan selesai dan CI lulus.
6. Target internal: maksimal 3-5 deployment Vercel per hari selama pengembangan normal.
7. Hindari redeploy commit yang sama. Bila preview sudah tervalidasi, gunakan promotion/alias ke production jika workflow Vercel mendukungnya, sehingga tidak perlu build ulang.
8. Perubahan dokumentasi, SQL, CI, README, refactor backend-only, dan commit eksperimen tidak memicu Vercel.

## Release Gate
Sebuah deployment baru hanya dilakukan bila salah satu kondisi berikut terpenuhi:
- perlu URL demo untuk pengguna/penguji;
- satu milestone UI selesai;
- perbaikan bug frontend sudah digabung dan CI lulus;
- akan dipromosikan menjadi versi produksi.

## Alur
`feature/backend work -> GitHub commit -> GitHub CI -> batch review -> satu preview Vercel -> QA -> promote/release`

## Catatan Kuota
Pada Hobby, preview deployment juga ikut menghitung batas deployment harian. Karena itu SIMASI tidak menggunakan strategi deploy-per-commit.
