create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  legacy_key text unique,
  display_name text not null default 'Dive User',
  city text,
  age integer check (age is null or age >= 18),
  intro text,
  interests text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.dates (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles(id) on delete cascade,
  legacy_key text unique,
  mode text not null check (mode in ('one', 'small')),
  title text not null,
  activity_content text not null,
  description text not null default '',
  vibe text[] not null default '{}',
  time_text text not null,
  starts_at timestamptz,
  area_text text not null,
  budget_amount integer not null default 0 check (budget_amount >= 0),
  currency text not null default 'CNY',
  payment_method text not null default 'AA',
  lock_fee_enabled boolean not null default false,
  lock_fee_amount integer not null default 0 check (lock_fee_amount >= 0),
  expectations text not null default '',
  capacity integer not null default 2 check (capacity between 2 and 5),
  cover_prompt text,
  cover_image_url text,
  visibility text not null default 'public' check (visibility in ('public', 'private')),
  status text not null default 'draft'
    check (status in ('draft', 'recruiting', 'full', 'completed', 'cancelled')),
  ai_proposal_text text,
  ai_tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint date_mode_capacity check (
    (mode = 'one' and capacity = 2)
    or (mode = 'small' and capacity between 3 and 5)
  ),
  constraint lock_fee_consistent check (
    (lock_fee_enabled and lock_fee_amount > 0)
    or (not lock_fee_enabled and lock_fee_amount = 0)
  )
);

create table public.saved_dates (
  user_id uuid not null references public.profiles(id) on delete cascade,
  date_id uuid not null references public.dates(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, date_id)
);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  date_id uuid not null references public.dates(id) on delete cascade,
  applicant_id uuid not null references public.profiles(id) on delete cascade,
  note text not null default '',
  status text not null default 'applied'
    check (status in ('applied', 'approved_pending_lock', 'locked', 'rejected', 'withdrawn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (date_id, applicant_id)
);

create table public.ai_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  mode text not null check (mode in ('one', 'small')),
  slots jsonb not null default '{}',
  missing_fields text[] not null default '{}',
  last_fields_asked text[] not null default '{}',
  unanswered_counts jsonb not null default '{}',
  phase text not null default 'collecting'
    check (phase in ('collecting', 'summary', 'proposal', 'complete')),
  input_revision integer not null default 1 check (input_revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ai_messages (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.ai_sessions(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  transcript text,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index dates_feed_idx on public.dates (status, visibility, created_at desc);
create index applications_date_idx on public.applications (date_id, status);
create index ai_messages_session_idx on public.ai_messages (session_id, created_at);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger dates_set_updated_at
before update on public.dates
for each row execute function public.set_updated_at();

create trigger applications_set_updated_at
before update on public.applications
for each row execute function public.set_updated_at();

create trigger ai_sessions_set_updated_at
before update on public.ai_sessions
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', 'Dive User')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.dates enable row level security;
alter table public.saved_dates enable row level security;
alter table public.applications enable row level security;
alter table public.ai_sessions enable row level security;
alter table public.ai_messages enable row level security;

revoke all on public.profiles, public.dates, public.saved_dates,
  public.applications, public.ai_sessions, public.ai_messages
from anon, authenticated;

grant select on public.profiles, public.dates to anon, authenticated;
grant update on public.profiles to authenticated;
grant insert, update on public.dates to authenticated;
grant select, insert, delete on public.saved_dates to authenticated;
grant select, insert on public.applications to authenticated;
grant select, insert, update, delete on public.ai_sessions, public.ai_messages
  to authenticated;
grant usage, select on sequence public.ai_messages_id_seq to authenticated;

create policy "profiles are publicly readable"
on public.profiles for select
using (true);

create policy "users update their own profile"
on public.profiles for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "published dates are readable"
on public.dates for select
using (
  (status in ('recruiting', 'full', 'completed') and visibility = 'public')
  or (select auth.uid()) = host_id
);

create policy "hosts create their own dates"
on public.dates for insert to authenticated
with check ((select auth.uid()) = host_id);

create policy "hosts update their own dates"
on public.dates for update to authenticated
using ((select auth.uid()) = host_id)
with check ((select auth.uid()) = host_id);

create policy "users read their own saves"
on public.saved_dates for select to authenticated
using ((select auth.uid()) = user_id);

create policy "users create their own saves"
on public.saved_dates for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "users delete their own saves"
on public.saved_dates for delete to authenticated
using ((select auth.uid()) = user_id);

create policy "applicants and hosts read applications"
on public.applications for select to authenticated
using (
  (select auth.uid()) = applicant_id
  or exists (
    select 1
    from public.dates d
    where d.id = date_id
      and d.host_id = (select auth.uid())
  )
);

create policy "guests apply to recruiting dates"
on public.applications for insert to authenticated
with check (
  (select auth.uid()) = applicant_id
  and exists (
    select 1
    from public.dates d
    where d.id = date_id
      and d.host_id <> (select auth.uid())
      and d.status = 'recruiting'
  )
);

create policy "users own their ai sessions"
on public.ai_sessions for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "users own their ai messages"
on public.ai_messages for all to authenticated
using (
  exists (
    select 1
    from public.ai_sessions s
    where s.id = session_id
      and s.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.ai_sessions s
    where s.id = session_id
      and s.user_id = (select auth.uid())
  )
);

comment on table public.dates is
  'Public and host-owned Date data. Exact locations must live in a separate private table.';
