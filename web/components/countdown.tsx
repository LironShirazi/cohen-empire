"use client";

import { useEffect, useState } from "react";

interface Parts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function diff(target: Date): Parts | null {
  const ms = target.getTime() - Date.now();
  if (ms <= 0) return null;
  const s = Math.floor(ms / 1000);
  return {
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
  };
}

const labels: Record<keyof Parts, string> = {
  days: "ימים",
  hours: "שעות",
  minutes: "דקות",
  seconds: "שניות",
};

export function Countdown({ target }: { target: string }) {
  const [parts, setParts] = useState<Parts | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const targetDate = new Date(target);
    const tick = () => setParts(diff(targetDate));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);

  // נמנע מאי-התאמת הידרציה: מרנדרים מקפים עד שהשעון רץ בדפדפן
  const shown: Parts = mounted && parts ? parts : { days: 0, hours: 0, minutes: 0, seconds: 0 };

  if (mounted && parts === null) {
    return (
      <p className="text-2xl font-bold text-accent-strong">המירוץ יצא לדרך! 🏁</p>
    );
  }

  return (
    <div className="flex flex-row-reverse justify-center gap-3 sm:gap-4" dir="ltr">
      {(Object.keys(labels) as (keyof Parts)[]).map((key) => (
        <div
          key={key}
          className="flex w-18 flex-col items-center rounded-2xl bg-primary px-2 py-3 text-primary-foreground sm:w-22"
        >
          <span className="text-3xl font-bold tabular-nums sm:text-4xl">
            {mounted ? String(shown[key]).padStart(2, "0") : "--"}
          </span>
          <span className="mt-1 text-xs opacity-80">{labels[key]}</span>
        </div>
      ))}
    </div>
  );
}
