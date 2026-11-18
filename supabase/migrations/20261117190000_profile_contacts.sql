alter table public.profiles
  add column if not exists phone text,
  add column if not exists show_phone boolean not null default false,
  add column if not exists contact_email text,
  add column if not exists show_contact_email boolean not null default false;

alter table public.profiles drop constraint if exists profiles_phone_ok;
alter table public.profiles
  add constraint profiles_phone_ok check (phone is null or phone ~ '^[0-9+(). -]{7,20}$');

alter table public.profiles drop constraint if exists profiles_contact_email_ok;
alter table public.profiles
  add constraint profiles_contact_email_ok check (
    contact_email is null
    or (
      char_length(contact_email) <= 160
      and contact_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    )
  );

alter table public.profiles drop constraint if exists profiles_phone_opt_in;
alter table public.profiles
  add constraint profiles_phone_opt_in check (not show_phone or phone is not null);

alter table public.profiles drop constraint if exists profiles_contact_email_opt_in;
alter table public.profiles
  add constraint profiles_contact_email_opt_in check (not show_contact_email or contact_email is not null);

grant update (phone, show_phone, contact_email, show_contact_email) on public.profiles to authenticated;
