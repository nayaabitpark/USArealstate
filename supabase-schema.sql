-- USA Real Estate: run this in Supabase SQL Editor.
-- Public users can submit leads and view active properties only.
-- Only authenticated users listed in admin_users can read leads or manage properties.

create extension if not exists pgcrypto;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  price numeric(14,2) not null check (price >= 0),
  listing_type text not null check (listing_type in ('rent','sale')),
  address text,
  city text,
  state text,
  zip_code text,
  beds integer not null default 0 check (beds >= 0),
  baths numeric(4,1) not null default 0 check (baths >= 0),
  sqft integer check (sqft is null or sqft >= 0),
  image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(full_name) between 1 and 120),
  phone text not null check (char_length(phone) between 5 and 30),
  email text not null check (char_length(email) between 5 and 254),
  interest text not null check (interest in ('rent','buy','both')),
  preferred_location text,
  message text,
  contact_consent boolean not null default false check (contact_consent = true),
  marketing_consent boolean not null default false,
  source text not null default 'website',
  status text not null default 'new' check (status in ('new','contacted','qualified','closed')),
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;
alter table public.properties enable row level security;
alter table public.leads enable row level security;

-- Admin can only see their own allow-list row. No client-side insert/update/delete policy.
drop policy if exists "Admins can read own admin row" on public.admin_users;
create policy "Admins can read own admin row" on public.admin_users
for select to authenticated using (user_id = (select auth.uid()));

-- Public can see active listings; admins can see/manage all listings.
drop policy if exists "Anyone can view active properties" on public.properties;
create policy "Anyone can view active properties" on public.properties
for select to anon, authenticated using (
  is_active = true or exists (
    select 1 from public.admin_users au where au.user_id = (select auth.uid())
  )
);
drop policy if exists "Admins insert properties" on public.properties;
create policy "Admins insert properties" on public.properties
for insert to authenticated with check (
  exists (select 1 from public.admin_users au where au.user_id = (select auth.uid()))
);
drop policy if exists "Admins update properties" on public.properties;
create policy "Admins update properties" on public.properties
for update to authenticated using (
  exists (select 1 from public.admin_users au where au.user_id = (select auth.uid()))
) with check (
  exists (select 1 from public.admin_users au where au.user_id = (select auth.uid()))
);
drop policy if exists "Admins delete properties" on public.properties;
create policy "Admins delete properties" on public.properties
for delete to authenticated using (
  exists (select 1 from public.admin_users au where au.user_id = (select auth.uid()))
);

-- Anyone can submit an inquiry. No public read/update/delete policy.
drop policy if exists "Visitors can submit leads" on public.leads;
create policy "Visitors can submit leads" on public.leads
for insert to anon, authenticated with check (
  contact_consent = true
  and status = 'new'
  and source = 'website'
  and char_length(full_name) between 1 and 120
  and char_length(phone) between 5 and 30
  and char_length(email) between 5 and 254
);
drop policy if exists "Admins can read leads" on public.leads;
create policy "Admins can read leads" on public.leads
for select to authenticated using (
  exists (select 1 from public.admin_users au where au.user_id = (select auth.uid()))
);
drop policy if exists "Admins can update leads" on public.leads;
create policy "Admins can update leads" on public.leads
for update to authenticated using (
  exists (select 1 from public.admin_users au where au.user_id = (select auth.uid()))
) with check (
  exists (select 1 from public.admin_users au where au.user_id = (select auth.uid()))
);

grant usage on schema public to anon, authenticated;
grant select on public.properties to anon, authenticated;
grant insert on public.leads to anon, authenticated;
grant select, insert, update, delete on public.properties to authenticated;
grant select, update on public.leads to authenticated;
-- Needed so the property SELECT policy can evaluate its admin-membership subquery.
-- RLS still returns no admin_users rows to anon visitors.
grant select on public.admin_users to anon, authenticated;

-- IMPORTANT: Create the Auth user in Supabase Dashboard first.
-- Then replace USER_AUTH_UUID below with that user's real UUID and run:
-- insert into public.admin_users (user_id) values ('USER_AUTH_UUID');
