import { supabase, supabaseEnabled } from "./supabase";

/**
 * 원격(Supabase) 저장 직후 GitHub Actions 동기화 워크플로를 시작합니다.
 * Edge `trigger-github-case-sync` 호출 시 유효한 JWT가 필요합니다.
 *
 * @param {{ accessToken?: string | null }} [opts] - AuthContext 세션 토큰(권장). 없으면 클라이언트에서 세션을 다시 읽습니다.
 * @returns {Promise<{ ok: boolean, skipped?: boolean, message?: string }>}
 */
export async function triggerGithubCasesWorkflow(opts = {}) {
  if (!supabaseEnabled || !supabase) {
    return { ok: true, skipped: true };
  }

  let token = opts.accessToken?.trim() || null;
  if (!token) {
    const { data: s1 } = await supabase.auth.getSession();
    token = s1.session?.access_token ?? null;
  }
  if (!token) {
    const { data: refreshed } = await supabase.auth.refreshSession();
    token = refreshed.session?.access_token ?? null;
  }

  if (!token) {
    return {
      ok: false,
      message:
        "GitHub 자동 동기화를 위해 로그인 세션이 필요합니다. 로그아웃 후 다시 로그인한 뒤 저장해 주세요.",
    };
  }

  const { error } = await supabase.functions.invoke("trigger-github-case-sync", {
    body: {},
    headers: { Authorization: `Bearer ${token}` },
  });
  if (error) {
    return { ok: false, message: error.message };
  }
  return { ok: true };
}
