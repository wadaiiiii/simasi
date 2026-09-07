-- SIMASI seminar lifecycle v1
-- Adds complete student -> staff verification -> revision -> complete cycle.

alter table public.pendaftaran_seminar
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists verified_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists revision_requested_at timestamptz,
  add column if not exists revision_submitted_at timestamptz,
  add column if not exists verified_by uuid references auth.users(id) on delete set null;

alter table public.berkas_seminar
  add column if not exists catatan_verifikator text,
  add column if not exists verified_at timestamptz,
  add column if not exists verified_by uuid references auth.users(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_berkas_seminar_status on public.berkas_seminar(status);
create index if not exists idx_pendaftaran_seminar_user_created on public.pendaftaran_seminar(user_id, created_at desc);

-- Keep historical values readable; new UI uses lengkap as final state.
update public.pendaftaran_seminar
set status='lengkap', completed_at=coalesce(completed_at, now()), updated_at=now()
where status='disetujui';

-- Staff can manage verification metadata through existing staff UPDATE RLS policies.
-- Student revisions persist through the authenticated upload Edge Function, which validates ownership.

create or replace function public.touch_simasi_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_pendaftaran_seminar_updated_at on public.pendaftaran_seminar;
create trigger trg_pendaftaran_seminar_updated_at
before update on public.pendaftaran_seminar
for each row execute function public.touch_simasi_updated_at();

drop trigger if exists trg_berkas_seminar_updated_at on public.berkas_seminar;
create trigger trg_berkas_seminar_updated_at
before update on public.berkas_seminar
for each row execute function public.touch_simasi_updated_at();

-- Harden public execute on trigger helper.
revoke all on function public.touch_simasi_updated_at() from public;
