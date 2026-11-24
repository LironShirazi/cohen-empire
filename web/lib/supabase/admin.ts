import { createClient } from "@supabase/supabase-js";
import { supabaseUrl } from "./env";

/**
 * לקוח service role — **צד שרת בלבד**, עוקף RLS.
 *
 * היחיד שצריך אותו היום הוא שליחת ה-Push (`app/api/push/story`), שחייב
 * לקרוא את המנויים של *כל* המשתמשים — מה שאף מדיניות לא מרשה, בכוונה.
 * ⚠️ לא לייבא מרכיב לקוח: המפתח לא מתחיל ב-`NEXT_PUBLIC_`, ולכן בקליינט
 * הוא `undefined`, אבל ייבוא כזה יכשל רק בזמן ריצה.
 *
 * מחזיר `null` כשהמפתח לא מוגדר — ה-Push הוא תוספת, והאפליקציה צריכה
 * לעבוד גם בלעדיו.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !key) return null;
  return createClient(supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
