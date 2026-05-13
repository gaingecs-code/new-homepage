-- public.cases 에 대한 테이블 권한을 다시 한 번 명시합니다 (멱등).
-- "permission denied for table cases" 가 나오면 이 마이그레이션을 원격 DB에 적용하세요.
-- Supabase SQL Editor 에서 실행해도 동일합니다.

grant usage on schema public to authenticated;

grant select, insert, update, delete on table public.cases to authenticated;
grant select, insert, update, delete on table public.cases to service_role;
