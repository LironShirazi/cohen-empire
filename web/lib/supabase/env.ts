export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** בשלב 0 האפליקציה צריכה לרוץ גם לפני שחיברנו פרויקט Supabase */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
