"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { LeaderboardRow } from "@/lib/supabase/types";

const medals: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

/**
 * לוח המובילים — סקיצה 2b. מסך קוסמי מלא, מקום ראשון בזהב.
 *
 * ⚠️ **דירוג בלבד — בלי "משימה 3 מתוך 7"** (docs/02 §3.3).
 *
 * ⚠️⚠️ **הסקיצה מראה שורת משנה "השלימו לאחרונה 14:42", והיא לא
 * ממומשת כאן.** `get_leaderboard` (0002) מחשבת `done` ו-`last_done`
 * לצורך המיון ו**במכוון לא מחזירה אותם** — הצגתן הייתה מחייבת לשנות
 * פונקציית `security definer` כדי לדלוף בדיוק את ההתקדמות שהכלל
 * אוסר לחשוף. הסקיצה גם סותרת את עצמה: הכיתוב בתחתיתה הוא "🤫 לא
 * מגלים באיזו תחנה כל קבוצה — כדי לשמור על המתח". מי שירצה את
 * החותמת בכל זאת — זה שינוי RPC ודיון, לא תיקון תצוגה.
 *
 * הרענון הוא בסקרים ולא ב-Realtime בכוונה: ל-RLS אין דרך לתת למשתתף
 * לראות את שורות ההתקדמות של קבוצות אחרות בלי לחשוף בדיוק את מה
 * שהדרישה אומרת להסתיר. השרת מחזיר מקום בלבד, והמסך שואל אותו שוב.
 */
export function LeaderboardList({
  rows,
  myTeamId,
}: {
  rows: LeaderboardRow[];
  myTeamId?: string;
}) {
  const router = useRouter();

  useEffect(() => {
    const timer = setInterval(() => router.refresh(), 10000);
    return () => clearInterval(timer);
  }, [router]);

  const listRef = useRankTransition(rows);

  if (rows.length === 0) {
    return (
      <p className="rounded-card border border-white/12 bg-white/5 p-5 text-center text-on-navy-muted">
        עוד אין קבוצות במירוץ הזה.
      </p>
    );
  }

  return (
    <ol ref={listRef} className="flex flex-col gap-2.5">
      {rows.map((row) => {
        const top = row.rank <= 3;
        return (
          <li
            key={row.team_id}
            data-team={row.team_id}
            className={`flex items-center gap-3 rounded-card text-start ${
              row.rank === 1
                ? "border border-gold bg-[color-mix(in_srgb,var(--gold-lite)_14%,transparent)] px-4 py-3.5"
                : top
                  ? "border border-white/18 bg-white/7 px-4 py-3.5"
                  : "border border-white/12 bg-white/5 px-4 py-3"
            }`}
          >
            <b
              className={`w-7 flex-none font-display font-normal ${
                top ? "text-[26px] text-gold-lite" : "text-[22px] text-on-navy-muted"
              }`}
            >
              {row.rank}
            </b>

            <span
              aria-hidden
              className={`flex flex-none items-center justify-center border-2 ${
                top ? "size-[46px] rounded-[14px] text-[26px]" : "size-10 rounded-xl text-[22px]"
              }`}
              style={{
                background: `color-mix(in srgb, ${row.team_color} 30%, var(--navy-tile))`,
                borderColor: row.team_color,
              }}
            >
              {row.team_animal?.split(" ")[0] ?? "🏁"}
            </span>

            <b className={`flex-1 text-white ${top ? "text-[19px]" : "text-[17px]"}`}>
              {row.team_name}
              {row.team_id === myTeamId ? (
                <span className="ms-1.5 rounded-full bg-brand px-2 py-0.5 align-[2px] text-xs">
                  אתם
                </span>
              ) : null}
            </b>

            {top ? <span className="text-2xl">{medals[row.rank]}</span> : null}
          </li>
        );
      })}
    </ol>
  );
}

/**
 * החלפת מקומות מונפשת (FLIP) — הסקיצה מציינת במפורש "מתעדכן בזמן
 * אמת · אנימציית החלפת מקום".
 *
 * בלי זה הרגע הדרמטי היחיד במסך — קבוצה שעוקפת קבוצה — קורה בקפיצה
 * בין שני רינדורים ואי אפשר לראות אותו בכלל.
 *
 * המדידה היא `offsetTop` ולא `getBoundingClientRect`: הראשון יחסי
 * למיכל ולכן חסין לגלילה שקרתה בין שני הסקרים, והשני היה מייצר
 * "קפיצה" מזויפת בגודל הגלילה.
 */
function useRankTransition(rows: LeaderboardRow[]) {
  const listRef = useRef<HTMLOListElement>(null);
  const previous = useRef(new Map<string, number>());

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const next = new Map<string, number>();

    for (const node of list.querySelectorAll<HTMLLIElement>("li[data-team]")) {
      const id = node.dataset.team;
      if (!id) continue;
      const top = node.offsetTop;
      next.set(id, top);

      const before = previous.current.get(id);
      // שורה חדשה (או ריצה ראשונה) לא "זזה" משום מקום
      if (before === undefined || before === top || reduce) continue;

      node.animate(
        [
          { transform: `translateY(${before - top}px)` },
          { transform: "translateY(0)" },
        ],
        { duration: 450, easing: "cubic-bezier(.34,1.56,.64,1)" }
      );
    }

    previous.current = next;
  }, [rows]);

  return listRef;
}
