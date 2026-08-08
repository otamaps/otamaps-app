create table public.wilma_identities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  issuer text not null,
  student_id bigint not null check (student_id > 0),
  role text not null check (role = 'student'),
  verified_first_name text not null check (btrim(verified_first_name) <> ''),
  verified_last_name text not null check (btrim(verified_last_name) <> ''),
  verified_name_normalized text not null check (btrim(verified_name_normalized) <> ''),
  verified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wilma_identities_issuer_student_key unique (issuer, student_id)
);

create index wilma_identities_user_id_idx
  on public.wilma_identities (user_id);

alter table public.wilma_identities enable row level security;

revoke all on table public.wilma_identities from anon, authenticated;
grant all on table public.wilma_identities to service_role;

comment on table public.wilma_identities is
  'Server-managed mapping from a verified Wilma student identity to a Supabase Auth user.';
comment on column public.wilma_identities.student_id is
  'Wilma student identifier scoped by issuer. Never use without issuer.';
