"use client";

import { useId, useState } from "react";

/**
 * תיבות ספרות — לפי design-system/components/inputs.html.
 * ספרות בלבד ומקלדת מספרים בנייד: קל להכתיב את הקוד בטלפון.
 *
 * מתחת למכסה זה input אחד אמיתי (שקוף) מעל התיבות, כדי שהטופס
 * ימשיך לעבוד רגיל — כולל autofill והגשה בלי JavaScript.
 */
export function CodeInput({
  name,
  length,
  tone = "brand",
  defaultValue = "",
  autoFocus,
}: {
  name: string;
  length: number;
  tone?: "brand" | "ink";
  defaultValue?: string;
  autoFocus?: boolean;
}) {
  const id = useId();
  const [value, setValue] = useState(defaultValue);

  const boxes = Array.from({ length }, (_, i) => value[i] ?? "");
  const filledStyle =
    tone === "brand" ? "border-brand text-brand" : "border-line text-ink";

  return (
    <div className="relative" dir="ltr">
      <input
        id={id}
        name={name}
        value={value}
        onChange={(event) =>
          setValue(event.target.value.replace(/\D/g, "").slice(0, length))
        }
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="one-time-code"
        maxLength={length}
        required
        autoFocus={autoFocus}
        aria-label={`קוד בן ${length} ספרות`}
        // הטקסט מוסתר בצבע שקוף ולא ב-font-size:0 — עם גופן בגודל 0
        // כרומיום פשוט לא מקבל הקלדה בכלל. 16px גם מונע זום אוטומטי
        // ב-iOS כשנכנסים לשדה.
        className="absolute inset-0 z-10 w-full text-center text-base text-transparent caret-transparent selection:bg-transparent selection:text-transparent outline-none"
        style={{ background: "transparent", border: 0 }}
      />
      <div className="pointer-events-none flex justify-center gap-2">
        {boxes.map((char, index) => (
          <span
            key={index}
            className={`flex h-14 w-11 items-center justify-center rounded-card-sm border-2 bg-white text-2xl font-bold ${
              char ? filledStyle : "border-line"
            } ${index === value.length ? "border-brand ring-4 ring-brand-soft" : ""}`}
          >
            {char}
          </span>
        ))}
      </div>
    </div>
  );
}
