-- SIMASI: fokus Seminar Proposal / Seminar Hasil
-- Sudah diterapkan ke project Supabase SIMASI.

alter table public.pendaftaran_seminar
  drop constraint if exists pendaftaran_seminar_jenis_ujian_check;

alter table public.pendaftaran_seminar
  add constraint pendaftaran_seminar_jenis_ujian_check
  check (jenis_ujian in ('Seminar Proposal','Seminar Hasil'));

update storage.buckets
set file_size_limit = 2097152,
    allowed_mime_types = array['application/pdf']
where id = 'seminar-documents';
