"use client";

import { useEffect, useState } from "react";

type Parts = { days: number; hours: number; minutes: number; seconds: number };

function partsUntil(target: Date): Parts {
  const diff = Math.max(0, target.getTime() - Date.now());
  const s = Math.floor(diff / 1000);
  return {
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
  };
}

const labels: { key: keyof Parts; label: string }[] = [
  { key: "days", label: "ימים" },
  { key: "hours", label: "שעות" },
  { key: "minutes", label: "דקות" },
  { key: "seconds", label: "שניות" },
];

export function Countdown({ target }: { target: string }) {
  // מרונדר רק אחרי mount כדי למנוע אי-התאמה בין שרת לקליינט
  const [parts, setParts] = useState<Parts | null>(null);

  useEffect(() => {
    const targetDate = new Date(target);
    const tick = () => setParts(partsUntil(targetDate));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);

  return (
    <div className="flex flex-row-reverse justify-center gap-2 sm:gap-4">
      {labels.map(({ key, label }) => (
        <div
          key={key}
          className="flex w-18 flex-col items-center rounded-card bg-white/90 py-3 shadow-card sm:w-24 sm:py-4"
        >
          <span className="tabular-nums text-3xl font-black text-primary sm:text-5xl">
            {parts ? String(parts[key]).padStart(2, "0") : "--"}
          </span>
          <span className="mt-1 text-xs font-medium text-ink-soft sm:text-sm">
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}
