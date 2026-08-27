"use client";

import { useEffect, useState } from "react";
import type { HallOfFameRow } from "@/lib/supabase/types";

/**
 * תמונת הקבוצה הזוכה — ממוזערת בשורה, ובלחיצה נפתחת במסך מלא.
 *
 * התמונה בשורה היא 52–64px, וזו בדיוק תמונת קבוצה: בגודל הזה אי אפשר
 * לזהות בה אף אחד. הלחיצה היא הדרך היחידה לראות מי עומד שם, ולכן
 * הכפתור הוא הרכיב היחיד בהיכל התהילה שהוא לקוח — הרשימה עצמה
 * נשארת רכיב שרת.
 *
 * ⚠️ **בלי תמונה זה `span` ולא כפתור.** הפלייסהולדר (📷) הוא סימן
 * שאין מה לפתוח; כפתור שלא עושה כלום גרוע ממנו.
 */
export function HallOfFamePhoto({
  row,
  className,
}: {
  row: HallOfFameRow;
  className: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!row.photo_url) {
    return (
      <span
        aria-hidden
        className={`flex flex-none items-center justify-center rounded-card-sm bg-bg-2 text-xl opacity-40 ${className}`}
      >
        📷
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`הגדלת תמונת הקבוצה הזוכה ${row.year}`}
        className={`flex-none overflow-hidden rounded-card-sm border border-line ${className}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={row.photo_url}
          alt={`הקבוצה הזוכה ${row.year}`}
          className="size-full object-cover"
        />
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex flex-col gap-3 bg-ink/92 p-4 text-white"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="סגירה"
              className="min-h-11 min-w-11 rounded-full bg-white/15 text-xl"
            >
              ✕
            </button>
            <span className="font-display text-xl text-gold-lite">
              אלופי {row.year}
            </span>
          </div>

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={row.photo_url}
            alt={`הקבוצה הזוכה ${row.year}`}
            className="mx-auto max-h-full min-h-0 flex-1 object-contain"
          />

          <div className="text-center">
            <p className="text-lg font-extrabold">{row.team_name}</p>
            {row.members.length > 0 ? (
              <p className="text-sm opacity-80">{row.members.join(", ")}</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
