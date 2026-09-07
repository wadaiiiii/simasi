-- SIMASI: import mahasiswa, mandatory first-password change, and Google Drive metadata
-- Jalankan setelah supabase/schema.sql dan supabase/security_patch.sql.

create schema if not exists private;
revoke all on schema private from public;

alter table public.profiles add column if not exists must_change_password boolean not null default false;

alter table public.berkas_seminar add column if not exists storage_provider text not null default 'external_link';
alter table public.berkas_seminar add column if not exists drive_file_id text;
alter table public.berkas_seminar add column if not exists drive_folder_id text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'berkas_seminar_storage_provider_check'
      and conrelid = 'public.berkas_seminar'::regclass
  ) then
    alter table public.berkas_seminar
      add constraint berkas_seminar_storage_provider_check
      check (storage_provider in ('google_drive','external_link','supabase'));
  end if;
end $$;

-- Helper ini tidak diekspos melalui Data API. Dipakai sebagai restrictive RLS gate.
create or replace function private.password_change_complete()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select not must_change_password from public.profiles where id = auth.uid()), false);
$$;

revoke all on function private.password_change_complete() from public;
grant usage on schema private to authenticated;
grant execute on function private.password_change_complete() to authenticated;

-- Akun mahasiswa dengan password awal belum diganti hanya boleh membaca profil/pengumuman.
-- Dosen dan admin tidak dibatasi oleh gate ini.
drop policy if exists "require password change mahasiswa" on public.mahasiswa;
create policy "require password change mahasiswa"
on public.mahasiswa as restrictive for all to authenticated
using (public.is_staff() or (select private.password_change_complete()))
with check (public.is_staff() or (select private.password_change_complete()));

drop policy if exists "require password change skripsi" on public.pengajuan_skripsi;
create policy "require password change skripsi"
on public.pengajuan_skripsi as restrictive for all to authenticated
using (public.is_staff() or (select private.password_change_complete()))
with check (public.is_staff() or (select private.password_change_complete()));

drop policy if exists "require password change logbook" on public.logbook_bimbingan;
create policy "require password change logbook"
on public.logbook_bimbingan as restrictive for all to authenticated
using (public.is_staff() or (select private.password_change_complete()))
with check (public.is_staff() or (select private.password_change_complete()));

drop policy if exists "require password change seminar" on public.pendaftaran_seminar;
create policy "require password change seminar"
on public.pendaftaran_seminar as restrictive for all to authenticated
using (public.is_staff() or (select private.password_change_complete()))
with check (public.is_staff() or (select private.password_change_complete()));

drop policy if exists "require password change berkas" on public.berkas_seminar;
create policy "require password change berkas"
on public.berkas_seminar as restrictive for all to authenticated
using (public.is_staff() or (select private.password_change_complete()))
with check (public.is_staff() or (select private.password_change_complete()));

drop policy if exists "require password change nilai" on public.nilai_skripsi;
create policy "require password change nilai"
on public.nilai_skripsi as restrictive for all to authenticated
using (public.is_staff() or (select private.password_change_complete()))
with check (public.is_staff() or (select private.password_change_complete()));

-- Kelayakan skripsi bukan lagi endpoint anonim dan hanya boleh melihat data sendiri,
-- kecuali dosen/admin yang memang memiliki akses staff.
create or replace function public.check_skripsi_eligibility(p_nim text)
returns table (
  nim text,
  nama text,
  prodi text,
  jurusan text,
  total_sks integer,
  metode_penelitian_lulus boolean,
  memenuhi_syarat boolean
)
language sql
stable
security invoker
set search_path = public
as $$
  select m.nim,m.nama,m.prodi,m.jurusan,m.total_sks,m.metode_penelitian_lulus,
         (m.total_sks >= 110 and m.metode_penelitian_lulus)
  from public.mahasiswa m
  where lower(m.nim)=lower(trim(p_nim))
    and (m.user_id = auth.uid() or public.is_staff())
  limit 1;
$$;

revoke all on function public.check_skripsi_eligibility(text) from public, anon;
grant execute on function public.check_skripsi_eligibility(text) to authenticated;
