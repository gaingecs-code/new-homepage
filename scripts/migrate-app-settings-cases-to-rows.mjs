/**
 * app_settings(admin.local.cases.v1) 단일 JSON → public.cases 행 단위 이전.
 *
 * 사용: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   node scripts/migrate-app-settings-cases-to-rows.mjs
 *   node scripts/migrate-app-settings-cases-to-rows.mjs --force   # cases 비우고 다시 이전
 */
import { createClient } from "@supabase/supabase-js";
import ws from "ws";

const STORAGE_KEY = "admin.local.cases.v1";

const force = process.argv.includes("--force");

async function main() {
  const url = (process.env.SUPABASE_URL || "").trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !key) {
    console.error("SUPABASE_URL 및 SUPABASE_SERVICE_ROLE_KEY 가 필요합니다.");
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false },
    realtime: { transport: ws },
  });

  const { count, error: cErr } = await supabase.from("cases").select("*", { count: "exact", head: true });
  if (cErr) {
    console.error("cases 테이블 조회 실패:", cErr.message);
    console.error("Supabase에 migrations/20260513140000_cases_row_storage.sql 을 적용했는지 확인하세요.");
    process.exit(1);
  }

  if ((count || 0) > 0 && !force) {
    console.log(`cases 테이블에 이미 ${count}행이 있습니다. 건너뜁니다. (--force 로 전체 삭제 후 재이전)`);
    process.exit(0);
  }

  if (force && (count || 0) > 0) {
    const { data: ids, error: idErr } = await supabase.from("cases").select("id");
    if (idErr) {
      console.error("cases id 목록 실패:", idErr.message);
      process.exit(1);
    }
    for (const row of ids || []) {
      const { error: delErr } = await supabase.from("cases").delete().eq("id", row.id);
      if (delErr) {
        console.error("행 삭제 실패:", row.id, delErr.message);
        process.exit(1);
      }
    }
    console.log("cases 테이블을 비웠습니다 (--force).");
  }

  const { data: row, error } = await supabase.from("app_settings").select("value").eq("key", STORAGE_KEY).maybeSingle();
  if (error) {
    console.error("app_settings 조회 실패:", error.message);
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
      console.error("행 삽입 실패:", id, insErr.message);
      process.exit(1);
    }
  }

  console.log("완료:", items.length, "건을 public.cases 로 이전했습니다.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
