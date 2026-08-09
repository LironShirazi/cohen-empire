"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { LeaderboardRow } from "@/lib/supabase/types";

const medals: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

/**
 * דירוג בלבד — בלי "משימה 3 מתוך 7" (docs/02-architecture.md §3.3).
 *
 * הרענון הוא בסקרים ולא ב-Realtime בכוונה: ל-RLS אין דרך לתת למשתתף
 * לראות את שורות ההתקדמות של קבוצות אחרות בלי לחשוף בדיוק את מה
 * שהדרישה אומרת להסתיר. השרת מחזיר מקום בלבד, והמסך שואל אותו שוב.
 */
export function LeaderboardList({ rows }: { rows: LeaderboardRow[] }) {
  const router = useRouter();

  useEffect(() => {
    const timer = setInterval(() => router.refresh(), 10000);
    return () => clearInterval(timer);
  }, [router]);

  if (rows.length === 0) {
    return (
      <p className="rounded-card border border-line bg-surface p-5 text-center text-muted">
        עוד אין קבוצות במירוץ הזה.
      </p>
    );
  }

  return (
    <ol className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
      {rows.map((row) => (
        <li
          key={row.team_id}
          className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0"
        >
          <span className="w-9 text-center text-xl font-extrabold text-muted">
            {medals[row.rank] ?? row.rank}
          </span>
          <span
            className="size-3.5 flex-none rounded-full"
            style={{ background: row.team_color }}
          />
          <span className="font-bold">{row.team_name}</span>
          {row.team_animal ? (
            <span className="ms-auto text-xl">{row.team_animal.split(" ")[0]}</span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
