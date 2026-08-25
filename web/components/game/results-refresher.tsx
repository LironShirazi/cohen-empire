"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * מסך הזוכים בזמן שהמירוץ עוד רץ — הקבוצות שכבר חזרו לבית סבא
 * יושבות מולו ורואות את השאר נכנסות אחת אחרי השנייה.
 *
 * סקר ולא Realtime, מאותה סיבה כמו הלידרבורד (docs/02 §3.3): הנתון
 * שמשתנה כאן הוא `team_progress` של קבוצות אחרות, ו-RLS לא נותן
 * למשתתף להיות מנוי עליו. `get_race_results` היא זו שמחליטה מה מותר
 * לו לראות, והמסך פשוט שואל אותה שוב.
 */
export function ResultsRefresher({ everySeconds = 30 }: { everySeconds?: number }) {
  const router = useRouter();

  useEffect(() => {
    const timer = setInterval(() => router.refresh(), everySeconds * 1000);
    return () => clearInterval(timer);
  }, [everySeconds, router]);

  return null;
}
