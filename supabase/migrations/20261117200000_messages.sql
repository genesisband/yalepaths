create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table public.conversation_members (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  primary key (conversation_id, profile_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  constraint messages_body_ok check (char_length(btrim(body)) between 1 and 2000)
);

create index conversation_members_profile_idx on public.conversation_members (profile_id);
create index messages_conversation_created_idx on public.messages (conversation_id, created_at);

create or replace function public.is_conversation_member(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.conversation_members as member
    where member.conversation_id = target
      and member.profile_id = auth.uid()
  );
$$;

create or replace function public.open_conversation(other_profile uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing uuid;
  created uuid;
begin
  if auth.uid() is null or not public.current_user_is_eligible() then
    raise exception 'Yale email verification is required';
  end if;
  if other_profile is null or other_profile = auth.uid() then
    raise exception 'Choose another member';
  end if;
  if not exists (
    select 1
    from public.profiles as profile
    where profile.id = other_profile
      and exists (
        select 1
        from public.experiences as experience
        where experience.owner_id = profile.id
          and experience.shared = true
      )
  ) then
    raise exception 'That member is not available to message';
  end if;

  select member.conversation_id into existing
  from public.conversation_members as member
  where member.profile_id = auth.uid()
    and (
      select count(*)
      from public.conversation_members as all_members
      where all_members.conversation_id = member.conversation_id
    ) = 2
    and exists (
      select 1
      from public.conversation_members as other_member
      where other_member.conversation_id = member.conversation_id
        and other_member.profile_id = other_profile
    )
  limit 1;

  if existing is not null then
    return existing;
  end if;

  insert into public.conversations default values
  returning id into created;

  insert into public.conversation_members (conversation_id, profile_id)
  values (created, auth.uid()), (created, other_profile);

  return created;
end;
$$;

alter table public.conversations enable row level security;
alter table public.conversations force row level security;
alter table public.conversation_members enable row level security;
alter table public.conversation_members force row level security;
alter table public.messages enable row level security;
alter table public.messages force row level security;

create policy conversations_select
on public.conversations
for select
to authenticated
using (public.current_user_is_eligible() and public.is_conversation_member(id));

create policy conversation_members_select
on public.conversation_members
for select
to authenticated
using (public.current_user_is_eligible() and public.is_conversation_member(conversation_id));

create policy messages_select
on public.messages
for select
to authenticated
using (public.current_user_is_eligible() and public.is_conversation_member(conversation_id));

create policy messages_insert
on public.messages
for insert
to authenticated
with check (
  sender_id = auth.uid()
  and public.current_user_is_eligible()
  and public.is_conversation_member(conversation_id)
);

revoke all on public.conversations from public, anon, authenticated;
revoke all on public.conversation_members from public, anon, authenticated;
revoke all on public.messages from public, anon, authenticated;
grant select on public.conversations, public.conversation_members, public.messages to authenticated;
grant insert on public.messages to authenticated;
grant all privileges on public.conversations, public.conversation_members, public.messages to service_role;

revoke all on function public.is_conversation_member(uuid) from public;
revoke all on function public.open_conversation(uuid) from public;
grant execute on function public.is_conversation_member(uuid) to authenticated;
grant execute on function public.open_conversation(uuid) to authenticated;
