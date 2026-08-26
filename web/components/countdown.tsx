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
    return (
      <p className="goldtext font-display text-3xl">המירוץ יצא לדרך! 🏁</p>
    );
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
    // ימים משמאל ושניות מימין — הספירה נקראת כמו שעון דיגיטלי,
    // ולכן LTR. (ב-design-system/components/countdown.html הסדר הפוך,
    // כי שם הוא יורש RTL מה-html; זו החלטה מודעת לסטות ממנו.)
    // האריחים שקופים ולא כחולים־מלאים: הם יושבים **בתוך** ההיירו
    // הקוסמי (סקיצה 1a), ולא עומדים לבדם על נייר. כרטיס navy מלא על
    // רקע navy היה קופסה בתוך קופסה.
    <div className="flex justify-center gap-2" dir="ltr">
      {(Object.keys(labels) as Unit[]).map((unit) => (
        <div
          key={unit}
          className="min-w-[72px] rounded-[14px] border border-gold-lite/35 bg-white/8 px-1.5 py-3"
        >
          <span className="block font-display text-[36px] leading-none font-normal tabular-nums text-gold-lite">
            {total === null ? "--" : String(parts[unit]).padStart(2, "0")}
          </span>
          <span className="mt-1 block text-xs text-on-navy-muted">
            {labels[unit]}
          </span>
        </div>
      ))}
    </div>
  );
}
