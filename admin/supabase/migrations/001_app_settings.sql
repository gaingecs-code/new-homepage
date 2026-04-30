-- 기업교육 소개 썸네일 "종료" 등 사이트 설정 (JSONB)
-- Supabase SQL Editor에서 한 번 실행하거나, Supabase CLI로 마이그레이션 적용

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

-- 공개 사이트에서 GET으로 읽을 수 있어야 JSON 동기화 가능 (또는 Edge로만 읽기)
create policy "app_settings_select_anon" on public.app_settings
  for select
  to anon, authenticated
  using (true);

create policy "app_settings_insert_auth" on public.app_settings
  for insert
  to authenticated
  with check (true);

create policy "app_settings_update_auth" on public.app_settings
  for update
  to authenticated
  using (true)
  with check (true);

create policy "app_settings_delete_auth" on public.app_settings
  for delete
  to authenticated
  using (true);

comment on table public.app_settings is 'key-value JSON. corporate_education_intro_ended: 교육 소개 썸네일별 종료 여부.';
