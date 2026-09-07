# SIMASI Vercel Deployment Policy

## Backend Laravel
Branch `laravel-backend` tidak boleh memicu deployment Vercel otomatis. Laravel tetap disiapkan untuk hosting PHP-compatible.

## Penghematan Kuota
- `git.deploymentEnabled=false` pada `vercel.json`.
- GitHub CI tetap berjalan setiap push tanpa memakai kuota deployment Vercel.
- Vercel hanya dipakai untuk frontend/static preview atau demo ketika diperlukan.
- Batch beberapa perubahan sebelum membuat preview.
- Target internal maksimal 3-5 deployment Vercel per hari.
- Jangan redeploy perubahan dokumentasi/backend-only.
- Jika preview sudah lolos QA dan akan dijadikan production, utamakan promotion/alias daripada build ulang bila memungkinkan.

## Alur
`Laravel development -> GitHub CI -> batch selesai -> frontend preview bila perlu -> QA -> release`
