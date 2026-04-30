import { supabase, supabaseEnabled } from "./supabase";

const ROW_KEY = "corporate_education_intro_ended";

export function getDefaultIntroEnded() {
  return {
    "cert-1": false,
    "cert-2": false,
    "onboarding-1": false,
    "onboarding-2": false,
    "workshop-1": false,
    "workshop-2": false,
  };
}

function endedMapFromProgramPayload(payload) {
  const items = payload?.items;
  if (!Array.isArray(items)) return null;
  const o = {};
  for (const it of items) {
    if (it && it.id) o[it.id] = !!it.ended;
  }
  return Object.keys(o).length ? o : null;
}

/**
 * @returns {Promise<Record<string, boolean>>}
 */
export async function loadIntroEnded() {
  const defaults = getDefaultIntroEnded();
  if (supabaseEnabled) {
    const { data, error } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", ROW_KEY)
      .maybeSingle();
    if (!error && data?.value && typeof data.value === "object") {
      return { ...defaults, ...data.value };
    }
  }
  try {
    const r = await fetch("/data/corporate-education-programs.json", { cache: "no-store" });
    if (r.ok) {
      const j = await r.json();
      const m = endedMapFromProgramPayload(j);
      if (m) return { ...defaults, ...m };
    }
  } catch {
    /* ignore */
  }
  const r2 = await fetch("/data/corporate-education-intro-ended.json", { cache: "no-store" });
  if (r2.ok) {
    const j2 = await r2.json();
    return { ...defaults, ...j2 };
  }
  return { ...defaults };
}

/**
 * @param {Record<string, boolean>} ended
 */
export async function saveIntroEndedToSupabase(ended) {
  if (!supabaseEnabled) {
    return { data: null, error: { message: "Supabase가 설정되어 있지 않습니다." } };
  }
  return supabase.from("app_settings").upsert(
    {
      key: ROW_KEY,
      value: ended,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" }
  );
}

export function buildIntroEndedJsonBlob(ended) {
  const o = { ...getDefaultIntroEnded(), ...ended };
  return new Blob([JSON.stringify(o, null, 2) + "\n"], { type: "application/json" });
}
