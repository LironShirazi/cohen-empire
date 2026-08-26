"use client";

import { useState, useTransition } from "react";
import { arriveAction } from "@/app/team/actions";
import { Button } from "@/components/ui/button";
import { formatDistance } from "@/lib/geo";

/**
 * "בדקו אם הגעתם" — המצב שבו מד המרחק כבוי (0016, ה-tweak
 * `showDistance` בסקיצות).
 *
 * ⚠️ **אין כאן מרחק כי אין כאן יעד.** כשהמתג כבוי `get_team_state`
 * מחזיר את קואורדינטות התחנה כ-`null`, ולכן אי אפשר לחשב מרחק גם
 * מ-DevTools. הקבוצה שולחת את המיקום שלה והשרת עונה כן/לא.
 *
 * ⚠️ וגם כשהמד דלוק — **ההכרעה תמיד של השרת** (docs/02 §3.1).
 * ההבדל היחיד הוא שכאן אין רמז ויזואלי לכיוון.
 */
export function BlindArrival({ teamId }: { teamId: string }) {
  const [pending, startTransition] = useTransition();
  const [tooFar, setTooFar] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  function check() {
    if (!("geolocation" in navigator)) {
      setError("הדפדפן לא תומך באיתור מיקום — בקשו מהמנהל לפתוח את המשימה ידנית");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) =>
        startTransition(async () => {
          const result = await arriveAction(
            teamId,
            position.coords.latitude,
            position.coords.longitude,
            position.coords.accuracy ?? null
          );
          // המסך מתרענן לבד כשהשרת מאשר
          if (!result.arrived) setTooFar(result.distance_m);
        }),
      (geoError) =>
        setError(
          geoError.code === geoError.PERMISSION_DENIED
            ? "אין הרשאת מיקום — צריך לאשר איתור מיקום כדי שהמשימה תיפתח"
            : "לא מצליחים לאתר את המיקום כרגע"
        ),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-full bg-ink px-4 py-3 text-center text-[22px] font-extrabold text-white">
        🔎 חפשו לפי הרמז
      </div>

      <Button size="lg" disabled={pending} onClick={check}>
        {pending ? "בודקים…" : "📍 בדקו אם הגעתם"}
      </Button>

      {tooFar !== null ? (
        <p className="text-center text-sm text-muted">
          עוד לא — השרת מדד {formatDistance(tooFar)} מהתחנה
        </p>
      ) : null}

      {error ? (
        <p className="rounded-card-sm bg-yellow-soft px-3.5 py-2.5 text-sm font-bold">
          {error}
        </p>
      ) : null}
    </div>
  );
}
