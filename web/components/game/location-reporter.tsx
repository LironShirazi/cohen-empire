"use client";

import { useEffect, useRef } from "react";
import { reportLocationAction } from "@/app/team/actions";
import { distanceMeters } from "@/lib/geo";

/** לא מציפים את השרת: דיווח כל חצי דקה, או מוקדם יותר אם באמת זזו */
const MIN_INTERVAL_MS = 30000;
const MIN_MOVE_M = 25;

/**
 * דיווח המיקום של הקבוצה למפת המנהל (docs/04 §4).
 *
 * למה קומפוננטה נפרדת מ-`DistanceMeter`, שגם הוא מריץ `watchPosition`:
 * שני הדברים נראים דומה אבל חיים בזמנים שונים. מד המרחק קיים רק במצב
 * "בדרך לתחנה" ומשרת את הקבוצה; הדיווח הזה צריך לרוץ **בכל** מצב —
 * גם כשהם עומדים בתחנה וגם כשהם ממתינים לאישור, כי בדיוק אז המנהל
 * שואל "איפה הם". חיבור השניים היה מכפיף את המפה לתנאי הרינדור של
 * מסך המשימה.
 *
 * הדיווח הוא לתצוגה בלבד — פתיחת משימה עוברת דרך `arrive_at_station`
 * שמאמת מרחק בשרת (docs/02 §3.1).
 */
export function LocationReporter({ teamId }: { teamId: string }) {
  const last = useRef<{ lat: number; lng: number; at: number } | null>(null);

  useEffect(() => {
    if (!("geolocation" in navigator)) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        const now = Date.now();
        const previous = last.current;

        if (previous) {
          const moved = distanceMeters(
            previous.lat,
            previous.lng,
            latitude,
            longitude
          );
          if (now - previous.at < MIN_INTERVAL_MS && moved < MIN_MOVE_M) return;
        }

        last.current = { lat: latitude, lng: longitude, at: now };
        void reportLocationAction(teamId, latitude, longitude, accuracy ?? null);
      },
      // שקט: אם אין הרשאת מיקום, DistanceMeter הוא זה שמסביר למה
      () => {},
      { enableHighAccuracy: false, maximumAge: 30000, timeout: 30000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [teamId]);

  return (
    <p className="text-center text-xs text-muted">
      👀 בזמן המירוץ המיקום שלכם מוצג למנהל התורן על המפה — ולא לקבוצות
      האחרות.
    </p>
  );
}
