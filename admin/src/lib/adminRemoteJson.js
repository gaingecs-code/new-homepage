import { supabase, supabaseEnabled } from "./supabase";

export async function loadRemoteJsonByKey(storageKey, fallback) {
  if (!supabaseEnabled || !supabase) return fallback;
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", storageKey)
    .maybeSingle();

  if (error || !data || !data.value || typeof data.value !== "object") {
    return fallback;
  }
  return { ...fallback, ...data.value };
}

export async function saveRemoteJsonByKey(storageKey, value) {
  if (!supabaseEnabled || !supabase) {
    return { error: { message: "Supabase가 설정되어 있지 않습니다." } };
  }
  return supabase.from("app_settings").upsert(
    {
      key: storageKey,
      value,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" }
  );
}

