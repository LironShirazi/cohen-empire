"use client";

import { useTransition } from "react";
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
        onClick={() =>
          startTransition(() => {
            void setShowDistanceAction(raceId, !showDistance);
          })
        }
      >
        {showDistance ? "כיבוי המד — חיפוש אמיתי 🔎" : "הדלקת המד 📍"}
      </Button>
    </Card>
  );
}
