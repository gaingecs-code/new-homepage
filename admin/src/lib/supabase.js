import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const storageMode = String(import.meta.env.VITE_ADMIN_STORAGE_MODE || "local").toLowerCase();

export const isLocalMode = storageMode !== "remote";

export const supabaseEnabled = !isLocalMode && Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = supabaseEnabled
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
