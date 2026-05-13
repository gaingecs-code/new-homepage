/**
 * 로그인한 관리자만 호출 가능. GitHub repository_dispatch(sync-cases) 로
 * 저장소의 "Sync cases data from Supabase" 워크플로를 시작합니다.
 *
 * 배포: supabase functions deploy trigger-github-case-sync
 * 시크릿: supabase secrets set --project-ref <ref> GITHUB_DISPATCH_TOKEN=<classic PAT repo 권한>
 *         supabase secrets set --project-ref <ref> GITHUB_REPOSITORY=owner/repo
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization") || "";
  const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!jwt) {
    return new Response(JSON.stringify({ error: "missing_authorization" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !serviceKey) {
    return new Response(JSON.stringify({ error: "supabase_env_missing" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
  if (userErr || !userData?.user) {
    return new Response(JSON.stringify({ error: "invalid_session" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const ghToken = Deno.env.get("GITHUB_DISPATCH_TOKEN");
  const ghRepo = Deno.env.get("GITHUB_REPOSITORY");
  if (!ghToken || !ghRepo || !ghRepo.includes("/")) {
    return new Response(JSON.stringify({ error: "github_env_missing" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const [owner, repo] = ghRepo.trim().split("/");
  if (!owner || !repo) {
    return new Response(JSON.stringify({ error: "github_repository_invalid" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const dispatchRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/dispatches`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ghToken}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      "User-Agent": "supabase-edge-trigger-github-case-sync",
    },
    body: JSON.stringify({
      event_type: "sync-cases",
      client_payload: {},
    }),
  });

  if (!dispatchRes.ok) {
    const body = await dispatchRes.text();
    return new Response(
      JSON.stringify({ error: "github_dispatch_failed", status: dispatchRes.status, body }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
