import type { RaceStatus } from "@/lib/supabase/types";

/**
 * שמות הסטטוסים בעברית.
 *
 * ⚠️ **כאן ולא ב-`lib/data.ts`.** `data.ts` מייבא את לקוח השרת של
 * Supabase (ודרכו את `next/headers`), ולכן רכיב לקוח שמייבא ממנו —
 * גם רק קבוע טהור — שובר את הבנייה. `OwnerRaceTools` הוא הקורא
 * הראשון מצד הלקוח.
 */
export const raceStatusLabel: Record<RaceStatus, string> = {
  draft: "טיוטה",
  open: "פתוח להצטרפות",
  live: "רץ עכשיו",
  finished: "הסתיים",
  archived: "בארכיון",
};
