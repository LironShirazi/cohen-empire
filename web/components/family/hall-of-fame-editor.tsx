"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HallOfFameForm } from "@/components/family/hall-of-fame-form";
import { Icon } from "@/components/ui/icon";

/**
 * "ניהול היכל התהילה" — הוספת שנים, בתחתית `/hall-of-fame`, למנהל-על בלבד.
 *
 * המסך שמעליו נשאר כמו שכל המשפחה רואה אותו; עריכה ומחיקה של שנה
 * קיימת יושבות על השורה עצמה (`HallOfFameRowActions`). השער
 * (`profile.is_owner`) הוא נוחות — האכיפה היא ב-RLS (`is_owner()`, 0014).
 *
 * הטבלה נכתבת משני מקורות: `declare_winner` (0015) מוסיף שורה כשמוכרזים
 * אלופים באפליקציה, וכאן מוזנות ידנית השנים שקדמו לה.
 */
export function HallOfFameEditor() {
  const [open, setOpen] = useState(false);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 font-display text-h2">
        <Icon name="edit" size={22} className="text-brand" />
        ניהול היכל התהילה
      </h2>
      <p className="-mt-2 text-sm text-muted">
        גלוי למנהלי-על בלבד. מירוץ שמסתיים באפליקציה נכנס לבד — כאן מזינים
        את השנים שקדמו לה. עריכה ומחיקה — בכפתור העיפרון על השורה עצמה.
      </p>

      {open ? (
        <Card>
          <HallOfFameForm onDone={() => setOpen(false)} />
        </Card>
      ) : (
        <Button className="w-full" onClick={() => setOpen(true)}>
          <Icon name="plus" size={22} />
          שנה מההיסטוריה
        </Button>
      )}
    </section>
  );
}
