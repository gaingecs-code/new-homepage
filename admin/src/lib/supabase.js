import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
// 운영 실수 방지: 모드 누락 시 local 데모가 아니라 remote를 기본값으로 사용
const storageMode = String(import.meta.env.VITE_ADMIN_STORAGE_MODE || "remote").toLowerCase();

export const isLocalMode = storageMode !== "remote";

export const supabaseEnabled = !isLocalMode && Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = supabaseEnabled
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
