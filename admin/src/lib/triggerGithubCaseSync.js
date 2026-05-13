import { supabase, supabaseEnabled } from "./supabase";

/**
 * 원격(Supabase) 저장 직후 GitHub Actions 동기화 워크플로를 시작합니다.
 * Supabase Edge `trigger-github-case-sync` + 로그인 세션이 필요합니다.
 * @returns {{ ok: boolean, skipped?: boolean, message?: string }}
 */
export async function triggerGithubCasesWorkflow() {
  if (!supabaseEnabled || !supabase) {
    return { ok: true, skipped: true };
  }
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    return { ok: true, skipped: true };
  }
  const { error } = await supabase.functions.invoke("trigger-github-case-sync", { body: {} });
  if (error) {
    return { ok: false, message: error.message };
  }
  return { ok: true };
}
