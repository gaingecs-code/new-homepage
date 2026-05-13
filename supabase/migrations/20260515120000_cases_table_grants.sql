-- Admin(authenticated 세션)이 public.cases 를 읽고 쓸 수 있도록 테이블 권한을 명시합니다.
-- RLS 정책만 있고 GRANT 가 없으면 "permission denied for table cases" 가 날 수 있습니다.
-- Supabase SQL Editor 에서 실행하거나 supabase db push 로 적용하세요.

grant select, insert, update, delete on table public.cases to authenticated;
grant select, insert, update, delete on table public.cases to service_role;
