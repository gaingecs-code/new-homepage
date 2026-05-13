-- 사례 1건 = 1행. Admin은 upsert_case RPC(낙관적 잠금).
-- Supabase: SQL Editor 실행 또는 supabase db push

create table if not exists public.cases (
  id text primary key,
  payload jsonb not null,
  status text not null default 'draft',
  updated_at timestamptz not null default now(),
  version int not null default 1
);

create index if not exists cases_updated_at_idx on public.cases (updated_at desc);

alter table public.cases enable row level security;

drop policy if exists "cases_select_auth" on public.cases;
create policy "cases_select_auth" on public.cases for select to authenticated using (true);

drop policy if exists "cases_insert_auth" on public.cases;
create policy "cases_insert_auth" on public.cases for insert to authenticated with check (true);

drop policy if exists "cases_update_auth" on public.cases;
create policy "cases_update_auth" on public.cases for update to authenticated using (true) with check (true);

drop policy if exists "cases_delete_auth" on public.cases;
create policy "cases_delete_auth" on public.cases for delete to authenticated using (true);

create or replace function public.upsert_case(p_id text, p_payload jsonb, p_expected_version int)
returns table(ok boolean, new_version int, err text)
language plpgsql
security definer
set search_path = public
as $$
declare
  cur int;
begin
  select c.version into cur from public.cases c where c.id = p_id for update;

  if not found then
    if p_expected_version is distinct from 0 then
      ok := false;
      new_version := 0;
      err := 'create_requires_version_zero';
      return next;
      return;
    end if;

    insert into public.cases (id, payload, status, version, updated_at)
    values (
      p_id,
      p_payload,
      coalesce(nullif(trim(p_payload->>'status'), ''), 'draft'),
      1,
      now()
    );

    ok := true;
    new_version := 1;
    err := null;
    return next;
    return;
  end if;

  if cur is distinct from p_expected_version then
    ok := false;
    new_version := cur;
    err := 'version_mismatch';
    return next;
    return;
  end if;

  update public.cases c
  set
    payload = p_payload,
    status = coalesce(nullif(trim(p_payload->>'status'), ''), c.status),
    version = c.version + 1,
    updated_at = now()
  where c.id = p_id;

  ok := true;
  new_version := cur + 1;
  err := null;
  return next;
end;
$$;

revoke all on function public.upsert_case(text, jsonb, int) from public;
grant execute on function public.upsert_case(text, jsonb, int) to authenticated;
grant execute on function public.upsert_case(text, jsonb, int) to service_role;

create or replace function public.import_cases_replace_all(p_items jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  elem jsonb;
begin
  delete from public.cases;
  for elem in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    if (elem->>'id') is null or trim(elem->>'id') = '' then
      continue;
    end if;
    insert into public.cases (id, payload, status, version, updated_at)
    values (
      trim(elem->>'id'),
      elem,
      coalesce(nullif(trim(elem->>'status'), ''), 'draft'),
      1,
      now()
    );
  end loop;
end;
$$;

revoke all on function public.import_cases_replace_all(jsonb) from public;
grant execute on function public.import_cases_replace_all(jsonb) to authenticated;
grant execute on function public.import_cases_replace_all(jsonb) to service_role;
