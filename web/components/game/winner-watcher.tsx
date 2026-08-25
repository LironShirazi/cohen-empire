"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { RaceStatus } from "@/lib/supabase/types";

/**
 * מה שמדליק את מסך הזוכים — ולמי (docs/02 §3.11).
 *
 * ⚠️ **קבוצה שעוד בשטח לא מנויה ל-Realtime, בכוונה.** השורה של
 * `races` שהערוץ מוסר מכילה את `winner_declared_at` **כפי שהיא**, ואין
 * דרך לסנן עמודה מתוך אירוע Realtime (`races_read` הוא `using (true)`).
 * כלומר עצם המנוי היה שם בדפדפן של מי שעדיין רץ את המידע שכל שאר
 * המנגנון טורח להסתיר ממנו. לכן הערוץ נפתח **רק כשיש לאן לקפוץ** —
 * כשהקבוצה כבר סיימה את המסלול שלה.
 *
 * מי שעוד בשטח מקבל את הסקר בלבד (20 שניות, כמו `WaitingWatcher`).
 * זה מספיק: סגירת המירוץ היא לא רגע דרמטי עבורו, והשרת ממילא דוחה
 * את הפעולות שלו באותו רגע. הרינדור מהשרת יראה לו את הכרטיס הנכון —
 * **בלי לחטוף אותו באמצע מסך**, וזה גם למה שהסקר מרענן ולא מנווט.
 *
 * לקבוצה שסיימה יש שני אירועים שמקפיצים אותה: הכרזת האלופים (המירוץ
 * עדיין רץ לאחרים) וסגירת המירוץ.
 */
export function WinnerWatcher({
  raceId,
  teamDone,
}: {
  raceId: string;
  teamDone: boolean;
}) {
  const router = useRouter();

  useEffect(() => {
    const poll = setInterval(() => router.refresh(), 20000);
    if (!teamDone) return () => clearInterval(poll);

    const supabase = createClient();
    const channel = supabase
      .channel(`race-status-${raceId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "races",
          filter: `id=eq.${raceId}`,
        },
        (payload) => {
          const race = payload.new as {
            status?: RaceStatus;
            winner_declared_at?: string | null;
          };
          if (race.status === "finished" || race.winner_declared_at) {
            router.push("/winners");
          }
        }
      )
      .subscribe();

    return () => {
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [raceId, teamDone, router]);

  return null;
}
