"use client";

import { useState, useTransition } from "react";
import {
  ownerDeleteRaceAction,
  ownerSetRaceStatusAction,
} from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SelectField } from "@/components/ui/field";
import { useConfirm } from "@/components/ui/confirm";
import { raceStatusLabel } from "@/lib/race-status";
import type { RaceStatus } from "@/lib/supabase/types";

const statuses: RaceStatus[] = [
  "draft",
  "open",
  "live",
  "finished",
  "archived",
];

/**
 * שתי הפעולות ששמורות למנהל-על בלבד (0019) — ובכוונה **לא** בתוך
 * `RaceControls`.
 *
 * `RaceControls` הוא זרימת המירוץ כפי שהמנהל התורן חי אותה: פתיחת
 * הרשמה ← יציאה לדרך ← הכרזה ← סיום ← ארכוב, כפתור אחד בכל רגע.
 * כאן זה בדיוק ההפך — חריגה מהזרימה: החזרת מירוץ שארכב בטעות,
 * ומחיקת מירוץ בדיקה. ערבוב השניים היה הופך "ארכוב" לבחירה מתוך
 * רשימה, וזה מה שגורם ללחוץ עליו בהיסח הדעת באמצע מירוץ.
 */
export function OwnerRaceTools({
  raceId,
  raceName,
  status,
}: {
  raceId: string;
  raceName: string;
  status: RaceStatus;
}) {
  const confirm = useConfirm();
  const [value, setValue] = useState<RaceStatus>(status);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Card className="flex flex-col gap-3 border-2 border-dashed border-gold">
      <div>
        <h2 className="font-display text-h2">🗝️ כלים של מנהל-על</h2>
        <p className="text-sm text-muted">
          פעולות שמנהל תורן לא יכול לעשות. לא חלק ממהלך המירוץ הרגיל.
        </p>
      </div>

      <SelectField
        label="סטטוס המירוץ"
        hint="אפשר גם להוציא מארכיון — ואז המירוץ נפתח שוב לעריכה."
        value={value}
        onChange={(e) => setValue(e.target.value as RaceStatus)}
      >
        {statuses.map((option) => (
          <option key={option} value={option}>
            {raceStatusLabel[option]}
          </option>
        ))}
      </SelectField>

      <Button
        variant="secondary"
        size="md"
        disabled={pending || value === status}
        onClick={() =>
          startTransition(async () => {
            const result = await ownerSetRaceStatusAction(raceId, value);
            setError(result.error ?? null);
          })
        }
      >
        {value === status ? "זה הסטטוס הנוכחי" : "שינוי הסטטוס"}
      </Button>

      <p className="rounded-card-sm border border-brand bg-brand/14 px-3.5 py-3 text-sm">
        מחיקת המירוץ מוחקת <b>גם את הקבוצות, התחנות, ההתקדמות והצ׳אט</b> שלו,
        ואי אפשר לבטל אותה. שורת היכל התהילה של אותה שנה נשארת.
      </p>

      <Button
        variant="quiet"
        size="md"
        className="text-brand"
        disabled={pending}
        // ⚠️ `useConfirm` ולא `window.confirm` — ספארי בנייד משתיק
        // אותו והכפתור נראה מת (CLAUDE.md §14)
        onClick={async () => {
          const ok = await confirm({
            title: "מחיקת המירוץ",
            message: `למחוק את "${raceName}" על כל הקבוצות, התחנות והצ׳אט שלו? אי אפשר לבטל.`,
            confirmLabel: "מחיקה",
          });
          if (!ok) return;
          startTransition(async () => {
            const result = await ownerDeleteRaceAction(raceId);
            // בהצלחה הפעולה מנווטת ל-/admin ולא חוזרת לכאן
            setError(result?.error ?? null);
          });
        }}
      >
        🗑️ מחיקת המירוץ
      </Button>

      {error ? (
        <p className="rounded-card-sm bg-brand-soft px-3.5 py-2.5 text-sm font-bold text-brand">
          {error}
        </p>
      ) : null}
    </Card>
  );
}
