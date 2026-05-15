-- 문의 관리: Admin 전용 내부 메모 (공개 문의 API에는 포함하지 않음)
alter table public.inquiries
  add column if not exists admin_memo text;

comment on column public.inquiries.admin_memo is 'Admin 문의 관리용 내부 메모';

-- Admin(authenticated)이 문의 행을 갱신·삭제할 수 있도록 (이미 있으면 무해)
grant select, update, delete on table public.inquiries to authenticated;
grant select, insert, update, delete on table public.inquiries to service_role;
