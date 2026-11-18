-- Local stack only. Hosted Supabase already has these roles.
-- Do not run this against a shared production database.

do $$
begin
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'authenticator') then
    create role authenticator noinherit login password 'postgres';
  end if;
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'supabase_auth_admin') then
    create role supabase_auth_admin nologin noinherit;
  end if;
end
$$;

create schema if not exists auth;
grant usage on schema auth to postgres, supabase_auth_admin;

alter role authenticator with login password 'postgres';
grant anon, authenticated, service_role to authenticator;
grant connect on database yalepaths to authenticator, anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role, authenticator, supabase_auth_admin;
alter role authenticator set statement_timeout = '8s';
alter role authenticator set search_path = public;
alter role postgres in database yalepaths set search_path = public, auth;
