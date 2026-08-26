"use client";

import { useState, useTransition } from "react";
import { setShowDistanceAction } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/**
 * מד המרחק — ה-tweak `showDistance` מהסקיצות, שעד 0016 לא היה קיים
 * באפליקציה.
 *
 * כבוי = יש רמז, אין חץ. השרת מפסיק להחזיר את קואורדינטות התחנה
 * ולא רק מסתיר מספר, ולכן זה באמת הופך את התחנה לחיפוש.
 */
export function DistanceToggle({
  raceId,
  showDistance,
}: {
  raceId: string;
  showDistance: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <Card className="flex flex-col gap-2">
      <h2 className="font-display text-h2">📍 מד המרחק</h2>
      <p className="text-sm text-muted">
        {showDistance
          ? "הקבוצות רואות כמה מטרים נשארו לתחנה."
          : "הקבוצות רואות רק את הרמז — בלי חץ ובלי מרחק."}
      </p>
      <Button
        variant={showDistance ? "secondary" : "accent"}
        disabled={pending}
        // ⚠️ הקולבק חייב להיות `async` ולהמתין: קולבק סינכרוני מסיים
        // את ה-transition מיד, `pending` חוזר ל-false לפני שהבקשה
        // בכלל נחתה, והכפתור לא באמת ננעל מפני לחיצה כפולה.
        onClick={() =>
          startTransition(async () => {
            const result = await setShowDistanceAction(raceId, !showDistance);
            setError(result.error ?? null);
          })
        }
      >
        {showDistance ? "כיבוי המד — חיפוש אמיתי 🔎" : "הדלקת המד 📍"}
      </Button>

      {/* בלי זה כישלון נראה בדיוק כמו הצלחה: על מירוץ בארכיון
          `is_race_admin` מחזירה false, ה-RPC זורק, והמנהל לוחץ
          ולא קורה כלום */}
      {error ? (
        <p className="rounded-card-sm bg-brand-soft px-3.5 py-2.5 text-sm font-bold text-brand">
          {error}
        </p>
      ) : null}
    </Card>
  );
}
