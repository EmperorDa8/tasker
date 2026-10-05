-- Tasker licences: who owns which paid checkout.
--
-- The Tasker service is the only writer (it uses the service-role key, which
-- bypasses RLS). Signed-in users may read their own rows and nothing else, so
-- a leaked anon key or a user's own token can never grant or edit a licence.
--
-- Bachs stays the system of record for whether money arrived; this table only
-- records which account claimed which checkout, so one purchase unlocks one
-- account instead of being a shareable string.

create table if not exists public.licenses (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  -- unique: a checkout can be claimed by exactly one account, ever.
  checkout_id   text not null unique,
  product_id    text,
  plan          text not null default 'lifetime',
  status        text not null default 'active' check (status in ('active', 'refunded')),
  install_id    text,
  purchased_at  timestamptz,
  -- last time Bachs was asked whether this is still paid and unrefunded.
  verified_at   timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Foreign keys are not indexed automatically; every status lookup filters on it.
create index if not exists licenses_user_id_idx on public.licenses (user_id);

alter table public.licenses enable row level security;

-- New public tables are granted to anon/authenticated by default. Take it all
-- back, then give signed-in users read access to their own rows only.
revoke all on public.licenses from anon, authenticated;
grant select on public.licenses to authenticated;

drop policy if exists licenses_select_own on public.licenses;
create policy licenses_select_own on public.licenses
  for select to authenticated
  using (user_id = (select auth.uid()));
