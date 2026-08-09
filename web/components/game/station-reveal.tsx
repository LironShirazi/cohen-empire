"use client";

import Image from "next/image";
import { useCallback, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";

const confetti = [
  { dx: "-90px", dy: "-70px", color: "var(--yellow)" },
  { dx: "80px", dy: "-90px", color: "var(--brand)" },
  { dx: "-110px", dy: "20px", color: "var(--gold)" },
  { dx: "100px", dy: "30px", color: "#fff" },
  { dx: "-40px", dy: "-110px", color: "var(--brand)" },
  { dx: "40px", dy: "90px", color: "var(--yellow)" },
];

// ה-sessionStorage הוא ה"מקור החיצוני" כאן; useSyncExternalStore נותן לנו
// אותו בלי הבהוב הידרציה ובלי setState בתוך effect.
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * מעטפת הדגל — הרגע החי של פתיחת תחנה.
 *
 * מקור: claude-design/ui-screens (סקיצה 1i "פתיחת רמז") וגם
 * design-system/components/clue-reveal.html. זה **מסך מלא קוסמי**, לא
 * כרטיס בתוך העמוד: דגל המירוץ נוחת, מקישים עליו, הוא מתרומם כמו דש
 * מעטפה עם קונפטי, והרמז נחשף מתחתיו.
 *
 * לפי ההערה במערכת העיצוב זה קורה **בכל פתיחת תחנה או משימה חדשה**,
 * ולכן אותו רכיב משמש גם לרמז וגם לחשיפת המשימה בהגעה.
 */
export function StationReveal({
  stationId,
  position,
  phase,
  title,
  body,
  cta,
}: {
  stationId: string;
  position: number;
  phase: "clue" | "task";
  title: string;
  body: string;
  cta: string;
}) {
  const storageKey = `reveal:${phase}:${stationId}`;
  const [lifted, setLifted] = useState(false);

  const dismissed = useSyncExternalStore(
    subscribe,
    useCallback(() => sessionStorage.getItem(storageKey) === "1", [storageKey]),
    // בשרת המעטפה תמיד סגורה — היא נפתחת בהקשה של המשתתפים
    () => false
  );

  function dismiss() {
    sessionStorage.setItem(storageKey, "1");
    listeners.forEach((listener) => listener());
  }

  if (dismissed) return null;

  const band =
    phase === "task"
      ? `🎉 תחנה ${position} · המשימה`
      : `🏁 תחנה ${position} · רמז`;

  return (
    <div
      className={`cosmic reveal-scene fixed inset-0 z-50 flex flex-col px-6 pt-14 pb-8 text-center ${
        lifted ? "is-open" : ""
      }`}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <p className="goldtext font-display text-2xl">{title}</p>

      <div className="relative mt-3 flex-1">
        <div className="reveal-clue absolute inset-0 m-auto flex h-fit w-[296px] flex-col gap-3 rounded-card border-[3px] border-ink bg-surface p-4.5 shadow-card-lg">
          <div className="rounded-lg bg-ink px-2.5 py-1.5 font-display text-lg text-yellow">
            {band}
          </div>
          <p className="text-lg font-bold text-ink">{body}</p>
          <Button onClick={dismiss}>{cta}</Button>
        </div>

        <div className="reveal-burst pointer-events-none absolute inset-0 m-auto size-2.5">
          {confetti.map((piece, index) => (
            <i
              key={index}
              style={
                {
                  "--dx": piece.dx,
                  "--dy": piece.dy,
                  background: piece.color,
                } as React.CSSProperties
              }
            />
          ))}
        </div>

        {lifted ? null : (
          <button
            type="button"
            onClick={() => setLifted(true)}
            className="reveal-env"
            aria-label={`פתיחת ${phase === "task" ? "המשימה" : "הרמז"} של תחנה ${position}`}
          >
            <Image
              src="/brand/yellow-flag.jpg"
              alt=""
              fill
              sizes="312px"
              className="rounded-xl object-cover"
              priority
            />
            <span className="reveal-tap absolute inset-x-0 -top-10 text-center text-[15px] font-extrabold">
              <span className="rounded-full border-2 border-ink bg-yellow px-3.5 py-1 text-ink shadow-card">
                👆 לחצו לפתיחה
              </span>
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
