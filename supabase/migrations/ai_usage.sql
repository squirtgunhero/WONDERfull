-- Counts builds made from a description so one account, or everyone together, cannot run up
-- an unlimited bill on the site's Anthropic key. Only the function below can touch the table.
create table if not exists public.ai_usage (
  owner uuid not null references auth.users (id) on delete cascade,
  day date not null,
  builds integer not null default 0,
  primary key (owner, day)
);
alter table public.ai_usage enable row level security;

-- Adds one build for the signed-in account and says whether it is still inside the limits:
-- 40 a day for one account, 600 a day for the whole site. Days are counted in UTC.
create or replace function public.use_ai_build()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  today date := (now() at time zone 'utc')::date;
  per_account constant integer := 40;
  whole_site constant integer := 600;
  mine integer;
  everyone integer;
begin
  if me is null then
    return jsonb_build_object('allowed', false, 'used', 0, 'limit', per_account);
  end if;
  insert into public.ai_usage as u (owner, day, builds) values (me, today, 1)
  on conflict (owner, day) do update set builds = u.builds + 1
  returning u.builds into mine;
  select coalesce(sum(builds), 0) into everyone from public.ai_usage where day = today;
  return jsonb_build_object('allowed', mine <= per_account and everyone <= whole_site, 'used', least(mine, per_account), 'limit', per_account);
end;
$$;
revoke all on function public.use_ai_build() from public, anon;
grant execute on function public.use_ai_build() to authenticated;
