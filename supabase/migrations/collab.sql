-- Sharing a scene with other accounts, comments on a scene, and who may join a scene's live channel.

-- People a scene is shared with, by the email they sign in with.
create table if not exists public.project_members (
  project_id uuid not null references public.projects (id) on delete cascade,
  email text not null check (email = lower(email) and char_length(email) between 3 and 254),
  added_at timestamptz not null default now(),
  primary key (project_id, email)
);
alter table public.project_members enable row level security;

-- These run with the table owner's rights so the rules below can ask "is this person the owner / a member"
-- without the rules on projects and project_members calling each other in a loop.
create or replace function public.is_project_owner(pid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.projects p where p.id = pid and p.owner = (select auth.uid()));
$$;
create or replace function public.is_project_member(pid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.project_members m where m.project_id = pid and m.email = lower(coalesce((select auth.jwt()) ->> 'email', '')));
$$;
create or replace function public.can_edit_project(pid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_project_owner(pid) or public.is_project_member(pid);
$$;
revoke all on function public.is_project_owner(uuid), public.is_project_member(uuid), public.can_edit_project(uuid) from public, anon;
grant execute on function public.is_project_owner(uuid), public.is_project_member(uuid), public.can_edit_project(uuid) to authenticated;

create policy "owner and the member see who a scene is shared with" on public.project_members for select to authenticated
  using (public.is_project_owner(project_id) or email = lower(coalesce((select auth.jwt()) ->> 'email', '')));
create policy "owner shares a scene" on public.project_members for insert to authenticated with check (public.is_project_owner(project_id));
create policy "owner stops sharing, or a member leaves" on public.project_members for delete to authenticated
  using (public.is_project_owner(project_id) or email = lower(coalesce((select auth.jwt()) ->> 'email', '')));

-- Members can open and edit a shared scene.
create policy "members read shared scenes" on public.projects for select to authenticated using (public.is_project_member(id));
create policy "members edit shared scenes" on public.projects for update to authenticated
  using (public.is_project_member(id)) with check (public.is_project_member(id));

-- Only the owner decides who owns a scene and whether it is published.
create or replace function public.keep_owner_settings() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is not null and (select auth.uid()) <> old.owner then
    new.owner := old.owner;
    new.is_public := old.is_public;
  end if;
  return new;
end;
$$;
drop trigger if exists keep_owner_settings on public.projects;
create trigger keep_owner_settings before update on public.projects for each row execute function public.keep_owner_settings();

-- Imported models and pictures. The first version of these rules compared against the scene's name instead of
-- the file's path, so no upload could ever pass. They are replaced here and extended to members.
drop policy if exists "add assets to own scenes" on storage.objects;
drop policy if exists "read assets of own or published scenes" on storage.objects;
drop policy if exists "remove assets of own scenes" on storage.objects;
drop policy if exists "replace assets of own scenes" on storage.objects;
create or replace function public.asset_project(path text) returns uuid
language plpgsql immutable set search_path = '' as $$
begin
  return split_part(path, '/', 1)::uuid;
exception when others then
  return null;
end;
$$;
create or replace function public.project_is_public(pid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.projects p where p.id = pid and p.is_public);
$$;
grant execute on function public.asset_project(text), public.project_is_public(uuid) to anon, authenticated;
create policy "read assets of scenes you can open" on storage.objects for select
  using (bucket_id = 'assets' and (public.project_is_public(public.asset_project(name)) or public.can_edit_project(public.asset_project(name))));
create policy "add assets to scenes you can edit" on storage.objects for insert to authenticated
  with check (bucket_id = 'assets' and public.can_edit_project(public.asset_project(name)));
create policy "replace assets of scenes you can edit" on storage.objects for update to authenticated
  using (bucket_id = 'assets' and public.can_edit_project(public.asset_project(name)));
create policy "remove assets of own scenes" on storage.objects for delete to authenticated
  using (bucket_id = 'assets' and public.is_project_owner(public.asset_project(name)));
grant execute on function public.can_edit_project(uuid), public.is_project_owner(uuid) to anon;

-- Comments on a scene, optionally about one object.
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  author uuid not null default auth.uid() references auth.users (id) on delete cascade,
  author_email text not null default lower(coalesce(auth.jwt() ->> 'email', '')),
  body text not null check (char_length(body) between 1 and 1000),
  object_id text check (object_id is null or char_length(object_id) <= 40),
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists comments_project on public.comments (project_id, created_at);
alter table public.comments enable row level security;
create policy "people on a scene read its comments" on public.comments for select to authenticated using (public.can_edit_project(project_id));
create policy "people on a scene comment as themselves" on public.comments for insert to authenticated
  with check (public.can_edit_project(project_id) and author = (select auth.uid()) and author_email = lower(coalesce((select auth.jwt()) ->> 'email', '')));
create policy "people on a scene resolve comments" on public.comments for update to authenticated
  using (public.can_edit_project(project_id)) with check (public.can_edit_project(project_id));
create policy "authors and the owner delete comments" on public.comments for delete to authenticated
  using (author = (select auth.uid()) or public.is_project_owner(project_id));
-- A comment's words and author never change after it is written. Only "resolved" can.
create or replace function public.keep_comment_fixed() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.id := old.id; new.project_id := old.project_id; new.author := old.author; new.author_email := old.author_email;
  new.body := old.body; new.object_id := old.object_id; new.created_at := old.created_at;
  return new;
end;
$$;
drop trigger if exists keep_comment_fixed on public.comments;
create trigger keep_comment_fixed before update on public.comments for each row execute function public.keep_comment_fixed();

-- Live editing: each scene has a private channel named "scene:<id>". Only its owner and members may listen or send.
create or replace function public.can_join_topic(topic text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
begin
  if topic is null or left(topic, 6) <> 'scene:' then return false; end if;
  return public.can_edit_project(substr(topic, 7)::uuid);
exception when others then
  return false;
end;
$$;
revoke all on function public.can_join_topic(text) from public, anon;
grant execute on function public.can_join_topic(text) to authenticated;
create policy "people on a scene listen to its live channel" on realtime.messages for select to authenticated using (public.can_join_topic((select realtime.topic())));
create policy "people on a scene send on its live channel" on realtime.messages for insert to authenticated with check (public.can_join_topic((select realtime.topic())));

-- Trigger functions are run by the database, never called directly.
revoke all on function public.keep_owner_settings() from public, anon, authenticated;
revoke all on function public.keep_comment_fixed() from public, anon, authenticated;
