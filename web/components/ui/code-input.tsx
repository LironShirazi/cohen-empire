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
  size = "md",
  defaultValue = "",
  autoFocus,
}: {
  name: string;
  length: number;
  tone?: "brand" | "ink";
  /**
   * `lg` הוא קוד הקבוצה (סקיצה 1c) — תיבה אחת ענקית עם מסגרת אדומה
   * והילה. הקוד מוכתב בעל־פה בבית סבא באמצע רעש, והוא הדבר היחיד
   * על המסך: הסקיצה מגדילה אותו פי שניים מקוד המשחק בכוונה.
   */
  size?: "md" | "lg";
  defaultValue?: string;
  autoFocus?: boolean;
}) {
  const id = useId();
  const [value, setValue] = useState(defaultValue);

  const boxes = Array.from({ length }, (_, i) => value[i] ?? "");
  const filledStyle =
    tone === "brand" ? "border-brand text-brand" : "border-line text-ink";
  const box =
    size === "lg"
      ? "h-24 w-21 rounded-card border-[3px] text-[52px]"
      : "h-[58px] w-[46px] rounded-card-sm border-2 text-[26px]";

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
            // תיבה ריקה מקווקוות (סקיצה 1b) — אומרת "כאן חסר משהו"
            // בלי להיראות כמו שדה שגוי
            className={`flex items-center justify-center bg-white font-bold ${box} ${
              char ? filledStyle : "border-dashed border-line"
            } ${
              index === value.length
                ? "border-solid border-brand ring-4 ring-brand-soft"
                : ""
            }`}
          >
            {char}
          </span>
        ))}
      </div>
    </div>
  );
}
