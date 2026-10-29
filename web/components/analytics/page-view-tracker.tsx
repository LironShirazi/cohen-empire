"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";

const VISITOR_KEY = "ce-visitor-id";
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

// גיבוי למצב פרטי שבו localStorage זורק — מזהה לאורך הביקור בלבד
let memoryVisitorId: string | null = null;

function visitorId(): string {
  try {
    const stored = localStorage.getItem(VISITOR_KEY);
    if (stored) return stored;
    const id = crypto.randomUUID();
    localStorage.setItem(VISITOR_KEY, id);
    return id;
  } catch {
    memoryVisitorId ??= crypto.randomUUID();
    return memoryVisitorId;
  }
}

/**
 * רושם כל כניסה למסך ב-`page_views` (0020) — המקור של `/admin/stats`.
 *
 * ⚠️ **מזהי uuid בנתיב הופכים ל-`[id]`.** בלי זה "המסכים הנצפים" היו
 * מתפצלים לשורה לכל מירוץ ולכל אלבום, ואף מסך לא היה מגיע לראש הרשימה.
 *
 * ⚠️ **שגיאה נבלעת.** אנליטיקה שנכשלה לא שווה מסך שבור — ובמיוחד לא
 * באמצע מירוץ. גם `user_id` לא נשלח מכאן: השרת לוקח אותו מהסשן.
 */
export function PageViewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!isSupabaseConfigured || !pathname) return;
    const path = pathname.replace(UUID, "[id]");
    createClient()
      .rpc("log_page_view", { p_path: path, p_visitor_id: visitorId() })
      .then(
        () => undefined,
        () => undefined
      );
  }, [pathname]);

  return null;
}
