-- YalePaths membership and experiences.
-- Login emails stay in auth.users. Eligibility is the confirmed exact yale.edu domain.

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'supabase_auth_admin') then
    create role supabase_auth_admin nologin noinherit;
  end if;
end
$$;

create or replace function public.email_is_yale(mail text)
returns boolean
language sql
immutable
as $$
  select mail is not null and lower(btrim(mail)) ~ '^[^@[:space:]]+@yale\.edu$';
$$;

create or replace function public.current_user_is_eligible()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.users as u
    where u.id = auth.uid()
      and u.email_confirmed_at is not null
      and public.email_is_yale(u.email)
  );
$$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  class_year integer,
  linkedin_url text,
  show_linkedin boolean not null default false,
  yale_email_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_name_ok check (display_name is null or char_length(btrim(display_name)) between 1 and 80),
  constraint profiles_year_ok check (class_year is null or class_year between 1900 and 2100),
  constraint profiles_linkedin_ok check (
    linkedin_url is null or linkedin_url ~ '^https://(www\.)?linkedin\.com/.*'
  ),
  constraint profiles_linkedin_opt_in check (not show_linkedin or linkedin_url is not null)
);

create table public.experiences (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  role text not null,
  organization text not null,
  experience_type text not null,
  city text not null,
  region text not null default '',
  lat double precision not null,
  lng double precision not null,
  lab_name text,
  note text,
  start_year integer not null,
  start_month integer not null,
  end_year integer,
  end_month integer,
  ongoing boolean not null default false,
  shared boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint experiences_type_ok check (
    experience_type in ('internship', 'research', 'job', 'study_abroad', 'other')
  ),
  constraint experiences_coords_ok check (lat between -90 and 90 and lng between -180 and 180),
  constraint experiences_text_ok check (
    char_length(btrim(role)) between 1 and 120
    and char_length(btrim(organization)) between 1 and 160
    and char_length(btrim(city)) between 1 and 120
    and char_length(region) <= 160
    and (lab_name is null or char_length(lab_name) <= 160)
    and (note is null or char_length(note) <= 280)
  ),
  constraint experiences_dates_ok check (
    start_month between 1 and 12
    and start_year between 1900 and 2200
    and (
      (ongoing and end_year is null and end_month is null)
      or (
        not ongoing
        and end_year is not null
        and end_month between 1 and 12
        and (end_year > start_year or (end_year = start_year and end_month >= start_month))
      )
    )
  )
);

create index experiences_owner_id_idx on public.experiences (owner_id);
create index experiences_shared_city_idx on public.experiences (city) where shared;
create index experiences_shared_lab_idx on public.experiences (lab_name) where shared;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger experiences_set_updated_at
before update on public.experiences
for each row execute function public.set_updated_at();

create or replace function public.handle_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.email_is_yale(new.email) and new.email_confirmed_at is not null then
    insert into public.profiles (id, yale_email_verified)
    values (new.id, true)
    on conflict (id) do update
      set yale_email_verified = true,
          updated_at = pg_catalog.now();
  elsif new.email is not null and not public.email_is_yale(new.email) then
    update public.profiles
      set yale_email_verified = false,
          updated_at = pg_catalog.now()
      where id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_confirmed
after insert or update of email, email_confirmed_at on auth.users
for each row execute function public.handle_auth_user();

create or replace function public.ensure_profile()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  mail text;
  confirmed timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  select u.email, u.email_confirmed_at into mail, confirmed
  from auth.users as u
  where u.id = auth.uid();
  if confirmed is null or not public.email_is_yale(mail) then
    raise exception 'Yale email verification is required';
  end if;
  insert into public.profiles (id, yale_email_verified)
  values (auth.uid(), true)
  on conflict (id) do update
    set yale_email_verified = true,
        updated_at = pg_catalog.now();
end;
$$;

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

create or replace function public.hook_restrict_to_yale_email(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.email_is_yale(event->'user'->>'email') then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 400,
        'message', 'YalePaths is limited to yale.edu email addresses.'
      )
    );
  end if;
  return '{}'::jsonb;
end;
$$;

alter table public.profiles enable row level security;
alter table public.profiles force row level security;
alter table public.experiences enable row level security;
alter table public.experiences force row level security;

create policy profiles_select_own
on public.profiles
for select
to authenticated
using (id = auth.uid() and public.current_user_is_eligible());

create policy profiles_select_shared
on public.profiles
for select
to authenticated
using (
  public.current_user_is_eligible()
  and exists (
    select 1
    from public.experiences as e
    where e.owner_id = profiles.id
      and e.shared = true
  )
);

create policy profiles_update_own
on public.profiles
for update
to authenticated
using (id = auth.uid() and public.current_user_is_eligible())
with check (id = auth.uid() and public.current_user_is_eligible());

create policy experiences_select_own
on public.experiences
for select
to authenticated
using (owner_id = auth.uid() and public.current_user_is_eligible());

create policy experiences_select_shared
on public.experiences
for select
to authenticated
using (shared = true and public.current_user_is_eligible());

create policy experiences_insert_own
on public.experiences
for insert
to authenticated
with check (owner_id = auth.uid() and public.current_user_is_eligible());

create policy experiences_update_own
on public.experiences
for update
to authenticated
using (owner_id = auth.uid() and public.current_user_is_eligible())
with check (owner_id = auth.uid() and public.current_user_is_eligible());

create policy experiences_delete_own
on public.experiences
for delete
to authenticated
using (owner_id = auth.uid() and public.current_user_is_eligible());

revoke all on public.profiles from public, anon, authenticated;
revoke all on public.experiences from public, anon, authenticated;
grant usage on schema public to anon, authenticated, service_role, supabase_auth_admin;
grant select on public.profiles, public.experiences to anon, authenticated;
grant update (display_name, class_year, linkedin_url, show_linkedin) on public.profiles to authenticated;
grant insert, update, delete on public.experiences to authenticated;
grant all privileges on public.profiles, public.experiences to service_role;

revoke all on function public.email_is_yale(text) from public;
revoke all on function public.current_user_is_eligible() from public;
revoke all on function public.handle_auth_user() from public;
revoke all on function public.ensure_profile() from public;
revoke all on function public.delete_own_account() from public;
revoke all on function public.hook_restrict_to_yale_email(jsonb) from public;
revoke all on function public.set_updated_at() from public;

grant execute on function public.current_user_is_eligible() to anon, authenticated;
grant execute on function public.ensure_profile() to authenticated;
grant execute on function public.delete_own_account() to authenticated;
grant execute on function public.hook_restrict_to_yale_email(jsonb) to supabase_auth_admin;
