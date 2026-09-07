-- SIMASI staff program-study scope
-- Admin can manage all programs; Dosen/Staf only their own profile.prodi.

create or replace function public.can_manage_prodi(p_prodi text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and (
        p.role = 'admin'
        or (
          p.role = 'dosen'
          and nullif(trim(p.prodi), '') is not null
          and lower(trim(p.prodi)) = lower(trim(p_prodi))
        )
      )
  );
$$;

revoke all on function public.can_manage_prodi(text) from public;
grant execute on function public.can_manage_prodi(text) to authenticated;

-- Registration visibility and verification scope.
drop policy if exists "seminar read own/staff" on public.pendaftaran_seminar;
drop policy if exists "seminar read own/prodi staff" on public.pendaftaran_seminar;
create policy "seminar read own/prodi staff"
on public.pendaftaran_seminar
for select to authenticated
using (user_id = auth.uid() or public.can_manage_prodi(prodi));

drop policy if exists "seminar staff update" on public.pendaftaran_seminar;
drop policy if exists "seminar prodi staff update" on public.pendaftaran_seminar;
create policy "seminar prodi staff update"
on public.pendaftaran_seminar
for update to authenticated
using (public.can_manage_prodi(prodi))
with check (public.can_manage_prodi(prodi));

-- Document visibility/review follows its parent registration program study.
drop policy if exists "berkas read owner/staff" on public.berkas_seminar;
drop policy if exists "berkas read owner/prodi staff" on public.berkas_seminar;
create policy "berkas read owner/prodi staff"
on public.berkas_seminar
for select to authenticated
using (
  exists (
    select 1
    from public.pendaftaran_seminar p
    where p.id = pendaftaran_id
      and (p.user_id = auth.uid() or public.can_manage_prodi(p.prodi))
  )
);

drop policy if exists "berkas staff update" on public.berkas_seminar;
drop policy if exists "berkas prodi staff update" on public.berkas_seminar;
create policy "berkas prodi staff update"
on public.berkas_seminar
for update to authenticated
using (
  exists (
    select 1
    from public.pendaftaran_seminar p
    where p.id = pendaftaran_id
      and public.can_manage_prodi(p.prodi)
  )
)
with check (
  exists (
    select 1
    from public.pendaftaran_seminar p
    where p.id = pendaftaran_id
      and public.can_manage_prodi(p.prodi)
  )
);

create index if not exists idx_profiles_role_prodi on public.profiles(role, prodi);
