/**
 * app_settings(admin.local.cases.v1) 단일 JSON → public.cases 행 단위 이전.
 *
 * 사용: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   node scripts/migrate-app-settings-cases-to-rows.mjs
 *   node scripts/migrate-app-settings-cases-to-rows.mjs --force   # cases 비우고 다시 이전
 *
 * Realtime(ws) 미사용 — Windows libuv Assertion 등 불필요 이슈 방지.
 */
import { createClient } from "@supabase/supabase-js";

const STORAGE_KEY = "admin.local.cases.v1";

const force = process.argv.includes("--force");

function logSupabaseError(label, err) {
  if (!err) return;
  const head = label ? `${label}: ` : "";
  console.error(`${head}${err.message || "(message 없음)"}`);
  try {
    console.error("상세:", JSON.stringify(err, null, 2));
  } catch {
    console.error("상세:", String(err));
  }
}

async function main() {
  const url = (process.env.SUPABASE_URL || "").trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !key) {
    console.error("SUPABASE_URL 및 SUPABASE_SERVICE_ROLE_KEY 가 필요합니다.");
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false },
  });

  const { count, error: cErr } = await supabase.from("cases").select("*", { count: "exact", head: true });
  if (cErr) {
    console.error("cases 테이블 조회 실패.");
    logSupabaseError("", cErr);
    console.error(
      "확인: (1) migrations SQL 적용 (2) service_role JWT(보통 eyJ로 시작) — sb_secret 전용 키와 혼동 주의 (3) URL·키가 같은 프로젝트"
    );
    process.exit(1);
  }

  if ((count || 0) > 0 && !force) {
    console.log(`cases 테이블에 이미 ${count}행이 있습니다. 건너뜁니다. (--force 로 전체 삭제 후 재이전)`);
    process.exit(0);
  }

  if (force && (count || 0) > 0) {
    const { data: ids, error: idErr } = await supabase.from("cases").select("id");
    if (idErr) {
      console.error("cases id 목록 실패.");
      logSupabaseError("", idErr);
      process.exit(1);
    }
    for (const row of ids || []) {
      const { error: delErr } = await supabase.from("cases").delete().eq("id", row.id);
      if (delErr) {
        console.error("행 삭제 실패:", row.id);
        logSupabaseError("", delErr);
        process.exit(1);
      }
    }
    console.log("cases 테이블을 비웠습니다 (--force).");
  }

  const { data: row, error } = await supabase.from("app_settings").select("value").eq("key", STORAGE_KEY).maybeSingle();
  if (error) {
    console.error("app_settings 조회 실패.");
    logSupabaseError("", error);
    process.exit(1);
  }
  if (!row?.value) {
    console.error("app_settings 에 key=", STORAGE_KEY, " 데이터가 없습니다.");
    process.exit(1);
  }

  let raw = row.value;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      console.error("value 가 JSON 이 아닙니다.");
      process.exit(1);
    }
  }
  const items = Array.isArray(raw.items) ? raw.items : [];
  if (items.length === 0) {
    console.log("이전할 사례가 없습니다.");
    process.exit(0);
  }

  for (const item of items) {
    const id = item?.id;
    if (!id || typeof id !== "string") continue;
    const payload = { ...item, id };
    const { error: insErr } = await supabase.from("cases").insert({
      id,
      payload,
      status: String(item.status || "draft"),
      version: 1,
    });
    if (insErr) {
      console.error("행 삽입 실패:", id);
      logSupabaseError("", insErr);
      process.exit(1);
    }
  }

  console.log("완료:", items.length, "건을 public.cases 로 이전했습니다.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
