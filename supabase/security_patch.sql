-- SIMASI security hardening
-- Jalankan SETELAH supabase/schema.sql

-- 1) Cegah mahasiswa menaikkan role sendiri melalui PostgREST.
-- Role hanya boleh diubah lewat SQL Editor/admin tooling terpercaya.
revoke update on table public.profiles from authenticated;
grant update (full_name, prodi) on table public.profiles to authenticated;

-- 2) Mahasiswa hanya boleh mengubah isi logbook miliknya sendiri,
-- bukan catatan dosen atau status approval.
revoke update on table public.logbook_bimbingan from authenticated;
grant update (tanggal, uraian, file_url) on table public.logbook_bimbingan to authenticated;

-- Dosen/admin mereview logbook melalui RPC terkontrol.
create or replace function public.review_logbook(
  p_logbook_id uuid,
  p_catatan_dosen text,
  p_status_approval text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception 'Akses ditolak: hanya dosen/admin yang dapat mereview logbook';
  end if;

  update public.logbook_bimbingan
  set catatan_dosen = p_catatan_dosen,
      status_approval = p_status_approval
  where id = p_logbook_id;

  if not found then
    raise exception 'Logbook tidak ditemukan';
  end if;
end;
$$;

revoke all on function public.review_logbook(uuid,text,text) from public;
grant execute on function public.review_logbook(uuid,text,text) to authenticated;

-- 3) Pastikan role staff tidak dapat diubah dari browser biasa.
-- Contoh promosi role yang benar (jalankan manual di SQL Editor):
-- update public.profiles set role='admin' where email='admin@unsulbar.ac.id';
-- update public.profiles set role='dosen' where email='dosen@unsulbar.ac.id';
