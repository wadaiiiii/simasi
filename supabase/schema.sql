-- SIMASI Supabase schema + RLS
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  nim text unique,
  role text not null default 'mahasiswa' check (role in ('mahasiswa','dosen','admin')),
  prodi text,
  created_at timestamptz not null default now()
);

create table if not exists public.mahasiswa (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete set null,
  nim text unique not null,
  nama text not null,
  jurusan text,
  prodi text not null,
  angkatan integer,
  total_sks integer not null default 0 check (total_sks >= 0),
  metode_penelitian_lulus boolean not null default false,
  status text not null default 'aktif' check (status in ('aktif','cuti','lulus','nonaktif')),
  created_at timestamptz not null default now()
);

create table if not exists public.pengumuman (
  id uuid primary key default gen_random_uuid(),
  judul text not null,
  isi text not null,
  tanggal date not null default current_date,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.pengajuan_skripsi (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nim text not null,
  nama text not null,
  jurusan text,
  prodi text not null,
  judul text not null,
  abstrak text not null,
  status text not null default 'menunggu',
  catatan_dosen text,
  created_at timestamptz not null default now()
);

create table if not exists public.logbook_bimbingan (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nim text,
  tanggal date not null,
  uraian text not null,
  file_url text,
  catatan_dosen text,
  status_approval text not null default 'Menunggu',
  created_at timestamptz not null default now()
);

create table if not exists public.pendaftaran_seminar (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nim text not null,
  nama text not null,
  prodi text not null check (prodi in ('Matematika','Statistika','Aktuaria','Bioteknologi')),
  jenis_ujian text not null check (jenis_ujian in ('Seminar Proposal','Ujian Tutup Skripsi')),
  pas_foto_jumlah integer not null default 2 check (pas_foto_jumlah >= 1),
  status text not null default 'diajukan',
  catatan_verifikator text,
  created_at timestamptz not null default now()
);

create table if not exists public.berkas_seminar (
  id uuid primary key default gen_random_uuid(),
  pendaftaran_id uuid not null references public.pendaftaran_seminar(id) on delete cascade,
  jenis_berkas text not null,
  nama_berkas text not null,
  file_url text,
  file_path text,
  status text not null default 'terunggah',
  created_at timestamptz not null default now(),
  unique (pendaftaran_id, jenis_berkas)
);

create table if not exists public.nilai_skripsi (
  id uuid primary key default gen_random_uuid(),
  mahasiswa_id uuid references public.mahasiswa(id) on delete set null,
  nim text not null,
  nama text not null,
  prodi text not null,
  nilai_proposal numeric(5,2),
  nilai_bimbingan numeric(5,2),
  nilai_hasil numeric(5,2),
  nilai_ujian numeric(5,2),
  nilai_akhir numeric(5,2),
  status_sidang text not null default 'Siap Sidang',
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id,email,full_name,role)
  values (new.id,new.email,coalesce(new.raw_user_meta_data ->> 'full_name',new.email),'mahasiswa')
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.current_app_role()
returns text language sql stable security definer set search_path = public as $$
  select coalesce((select role from public.profiles where id = auth.uid()),'anon');
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select public.current_app_role() in ('dosen','admin');
$$;

create or replace function public.get_dashboard_stats()
returns table (mahasiswa_aktif bigint, judul_diajukan bigint, lulus_sidang bigint)
language sql stable security definer set search_path = public as $$
  select
    (select count(*) from public.mahasiswa where status='aktif'),
    (select count(*) from public.pengajuan_skripsi),
    (select count(*) from public.nilai_skripsi where lower(status_sidang)='lulus');
$$;

create or replace function public.get_kuliah_summary()
returns table (memenuhi_sks bigint, lulus_metpen bigint, pengajuan_menunggu bigint)
language sql stable security definer set search_path = public as $$
  select
    (select count(*) from public.mahasiswa where total_sks >= 110),
    (select count(*) from public.mahasiswa where metode_penelitian_lulus = true),
    (select count(*) from public.pengajuan_skripsi where status='menunggu');
$$;

create or replace function public.check_skripsi_eligibility(p_nim text)
returns table (nim text,nama text,prodi text,jurusan text,total_sks integer,metode_penelitian_lulus boolean,memenuhi_syarat boolean)
language sql stable security definer set search_path = public as $$
  select m.nim,m.nama,m.prodi,m.jurusan,m.total_sks,m.metode_penelitian_lulus,
         (m.total_sks >= 110 and m.metode_penelitian_lulus)
  from public.mahasiswa m where lower(m.nim)=lower(trim(p_nim)) limit 1;
$$;

revoke all on function public.get_dashboard_stats() from public;
revoke all on function public.get_kuliah_summary() from public;
revoke all on function public.check_skripsi_eligibility(text) from public;
grant execute on function public.get_dashboard_stats() to anon,authenticated;
grant execute on function public.get_kuliah_summary() to anon,authenticated;
grant execute on function public.check_skripsi_eligibility(text) to anon,authenticated;

alter table public.profiles enable row level security;
alter table public.mahasiswa enable row level security;
alter table public.pengumuman enable row level security;
alter table public.pengajuan_skripsi enable row level security;
alter table public.logbook_bimbingan enable row level security;
alter table public.pendaftaran_seminar enable row level security;
alter table public.berkas_seminar enable row level security;
alter table public.nilai_skripsi enable row level security;

create policy "profiles read own/staff" on public.profiles for select to authenticated using (id=auth.uid() or public.is_staff());
create policy "profiles update own" on public.profiles for update to authenticated using (id=auth.uid()) with check (id=auth.uid());

create policy "mahasiswa read own/staff" on public.mahasiswa for select to authenticated using (user_id=auth.uid() or public.is_staff());
create policy "mahasiswa staff insert" on public.mahasiswa for insert to authenticated with check (public.is_staff());
create policy "mahasiswa staff update" on public.mahasiswa for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "mahasiswa admin delete" on public.mahasiswa for delete to authenticated using (public.current_app_role()='admin');

create policy "pengumuman public read" on public.pengumuman for select to anon,authenticated using (is_active=true or public.is_staff());
create policy "pengumuman staff insert" on public.pengumuman for insert to authenticated with check (public.is_staff());
create policy "pengumuman staff update" on public.pengumuman for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "pengumuman admin delete" on public.pengumuman for delete to authenticated using (public.current_app_role()='admin');

create policy "skripsi read own/staff" on public.pengajuan_skripsi for select to authenticated using (user_id=auth.uid() or public.is_staff());
create policy "skripsi insert own" on public.pengajuan_skripsi for insert to authenticated with check (user_id=auth.uid());
create policy "skripsi staff update" on public.pengajuan_skripsi for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "skripsi admin delete" on public.pengajuan_skripsi for delete to authenticated using (public.current_app_role()='admin');

create policy "logbook read own/staff" on public.logbook_bimbingan for select to authenticated using (user_id=auth.uid() or public.is_staff());
create policy "logbook insert own" on public.logbook_bimbingan for insert to authenticated with check (user_id=auth.uid());
create policy "logbook update own/staff" on public.logbook_bimbingan for update to authenticated using (user_id=auth.uid() or public.is_staff()) with check (user_id=auth.uid() or public.is_staff());

create policy "seminar read own/staff" on public.pendaftaran_seminar for select to authenticated using (user_id=auth.uid() or public.is_staff());
create policy "seminar insert own" on public.pendaftaran_seminar for insert to authenticated with check (user_id=auth.uid());
create policy "seminar staff update" on public.pendaftaran_seminar for update to authenticated using (public.is_staff()) with check (public.is_staff());

create policy "berkas read owner/staff" on public.berkas_seminar for select to authenticated using (public.is_staff() or exists(select 1 from public.pendaftaran_seminar p where p.id=pendaftaran_id and p.user_id=auth.uid()));
create policy "berkas insert owner" on public.berkas_seminar for insert to authenticated with check (exists(select 1 from public.pendaftaran_seminar p where p.id=pendaftaran_id and p.user_id=auth.uid()));
create policy "berkas staff update" on public.berkas_seminar for update to authenticated using (public.is_staff()) with check (public.is_staff());

create policy "nilai read own/staff" on public.nilai_skripsi for select to authenticated using (public.is_staff() or exists(select 1 from public.mahasiswa m where m.id=mahasiswa_id and m.user_id=auth.uid()));
create policy "nilai staff insert" on public.nilai_skripsi for insert to authenticated with check (public.is_staff());
create policy "nilai staff update" on public.nilai_skripsi for update to authenticated using (public.is_staff()) with check (public.is_staff());

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('seminar-documents','seminar-documents',false,10485760,array['application/pdf','image/jpeg','image/png'])
on conflict (id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create policy "seminar storage insert own" on storage.objects for insert to authenticated
with check (bucket_id='seminar-documents' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "seminar storage read own/staff" on storage.objects for select to authenticated
using (bucket_id='seminar-documents' and ((storage.foldername(name))[1]=auth.uid()::text or public.is_staff()));
create policy "seminar storage delete own/staff" on storage.objects for delete to authenticated
using (bucket_id='seminar-documents' and ((storage.foldername(name))[1]=auth.uid()::text or public.is_staff()));

-- Promote staff roles only from trusted SQL/admin tooling:
-- update public.profiles set role='admin' where email='admin@unsulbar.ac.id';
-- update public.profiles set role='dosen' where email='dosen@unsulbar.ac.id';
