"use client";

import { useMemo, useSyncExternalStore } from "react";

const labels = {
  days: "ימים",
  hours: "שעות",
  minutes: "דקות",
  seconds: "שניות",
} as const;

type Unit = keyof typeof labels;

function secondsUntil(targetMs: number) {
  return Math.max(0, Math.floor((targetMs - Date.now()) / 1000));
}

/**
 * שעון חיצוני קטן: React נדגם ממנו דרך useSyncExternalStore, כך שאין setState
 * בתוך effect, וההידרציה מתחילה מ-null (מקפים) בלי אי-התאמה מול השרת.
 */
function createClock(targetMs: number) {
  let snapshot = secondsUntil(targetMs);
  const listeners = new Set<() => void>();
  let timer: ReturnType<typeof setInterval> | undefined;

  return {
    subscribe(onChange: () => void) {
      listeners.add(onChange);
      timer ??= setInterval(() => {
        const next = secondsUntil(targetMs);
        if (next === snapshot) return;
        snapshot = next;
        listeners.forEach((listener) => listener());
      }, 250);

      return () => {
        listeners.delete(onChange);
        if (listeners.size === 0) {
          clearInterval(timer);
          timer = undefined;
        }
      };
    },
    getSnapshot: () => snapshot,
    // בשרת (ובהידרציה) אין שעון — מרנדרים מקפים
    getServerSnapshot: (): number | null => null,
  };
}

export function Countdown({ target }: { target: string }) {
  const clock = useMemo(() => createClock(new Date(target).getTime()), [target]);
  const total = useSyncExternalStore(
    clock.subscribe,
    clock.getSnapshot,
    clock.getServerSnapshot
  );

  if (total === 0) {
    return <p className="font-display text-2xl text-brand">המירוץ יצא לדרך! 🏁</p>;
  }

  const parts: Record<Unit, number> =
    total === null
      ? { days: 0, hours: 0, minutes: 0, seconds: 0 }
      : {
          days: Math.floor(total / 86400),
          hours: Math.floor((total % 86400) / 3600),
          minutes: Math.floor((total % 3600) / 60),
          seconds: total % 60,
        };

  return (
    <div className="flex flex-row-reverse justify-center gap-3 sm:gap-4" dir="ltr">
      {(Object.keys(labels) as Unit[]).map((unit) => (
        <div
          key={unit}
          className="flex w-18 flex-col items-center rounded-card bg-navy px-2 py-3 text-gold-lite shadow-navy sm:w-22"
        >
          <span className="font-display text-3xl tabular-nums sm:text-4xl">
            {total === null ? "--" : String(parts[unit]).padStart(2, "0")}
          </span>
          <span className="mt-1 text-xs text-white/70">{labels[unit]}</span>
        </div>
      ))}
    </div>
  );
}
