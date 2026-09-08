-- SIMASI password reset request workflow
-- Public users submit through request-password-reset Edge Function.
-- Staff/Admin read and process through manage-password-reset Edge Function.

create table if not exists public.password_reset_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  full_name text,
  nim text,
  email text,
  role text not null,
  prodi text,
  status text not null default 'menunggu' check (status in ('menunggu','selesai')),
  requested_at timestamptz not null default now(),
  processed_at timestamptz,
  processed_by uuid references auth.users(id) on delete set null
);

create unique index if not exists password_reset_requests_one_pending_per_user
  on public.password_reset_requests(user_id)
  where status = 'menunggu';

create index if not exists password_reset_requests_status_requested_idx
  on public.password_reset_requests(status, requested_at desc);

create index if not exists password_reset_requests_prodi_role_idx
  on public.password_reset_requests(prodi, role, status);

alter table public.password_reset_requests enable row level security;

revoke all on table public.password_reset_requests from anon, authenticated;

grant all on table public.password_reset_requests to service_role;
