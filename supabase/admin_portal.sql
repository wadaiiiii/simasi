-- SIMASI admin portal + terminology alignment

-- Samakan seluruh istilah ujian menjadi Seminar Proposal / Seminar Hasil.
update public.pendaftaran_seminar
set jenis_ujian = 'Seminar Hasil'
where jenis_ujian = 'Ujian Tutup Skripsi';

alter table public.pendaftaran_seminar
  drop constraint if exists pendaftaran_seminar_jenis_ujian_check;

alter table public.pendaftaran_seminar
  add constraint pendaftaran_seminar_jenis_ujian_check
  check (jenis_ujian in ('Seminar Proposal','Seminar Hasil'));

create index if not exists idx_pendaftaran_seminar_created_at on public.pendaftaran_seminar(created_at desc);
create index if not exists idx_pendaftaran_seminar_status on public.pendaftaran_seminar(status);
create index if not exists idx_pendaftaran_seminar_prodi on public.pendaftaran_seminar(prodi);
create index if not exists idx_berkas_seminar_pendaftaran on public.berkas_seminar(pendaftaran_id);
create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_mahasiswa_user_id on public.mahasiswa(user_id);

-- Data Informasi Akademik harus bisa dibaca landing publik,
-- tetapi hanya baris yang is_active=true.
grant select on table public.pengumuman to anon, authenticated;

-- Hapus policy gabungan lama. Jangan panggil is_staff() dari policy anon,
-- karena role anon memang tidak diberi EXECUTE ke helper otorisasi staf.
drop policy if exists "pengumuman public read" on public.pengumuman;
drop policy if exists "pengumuman anon read active" on public.pengumuman;
drop policy if exists "pengumuman authenticated read active" on public.pengumuman;
drop policy if exists "pengumuman staff read all" on public.pengumuman;

create policy "pengumuman anon read active"
on public.pengumuman
for select
to anon
using (is_active = true);

create policy "pengumuman authenticated read active"
on public.pengumuman
for select
to authenticated
using (is_active = true);

create policy "pengumuman staff read all"
on public.pengumuman
for select
to authenticated
using (public.is_staff());
