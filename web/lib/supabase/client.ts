import { createBrowserClient } from "@supabase/ssr";
import { isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from "./env";

export function createClient() {
  if (!isSupabaseConfigured) {
    throw new Error(
      "Supabase לא מוגדר — יש למלא NEXT_PUBLIC_SUPABASE_URL ו-NEXT_PUBLIC_SUPABASE_ANON_KEY ב-.env.local"
    );
  }
  return createBrowserClient(supabaseUrl!, supabaseAnonKey!);
}
