"use client";

import { useEffect, useState } from "react";

export type Quote = { text: string; who: string; imageUrl?: string };

/** ציטוטים זמניים עד שמנהל-העל יזין את המשפטים האמיתיים דרך ניהול התוכן */
const placeholderQuotes: Quote[] = [
  { text: "העיקר שכולם ביחד", who: "סבא" },
  { text: "מי שלא רץ — שידחוף את העגלה", who: "סבתא" },
  { text: "בנגב ייבחן העם הזה", who: "סבא" },
];

export function QuoteRotator({ quotes }: { quotes?: Quote[] }) {
  const list = quotes?.length ? quotes : placeholderQuotes;
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % list.length), 7000);
    return () => clearInterval(id);
  }, [list.length]);

  const quote = list[index];

  return (
    <figure className="mx-auto max-w-md text-center">
      <blockquote className="text-xl font-medium leading-relaxed text-ink">
        ”{quote.text}“
      </blockquote>
      <figcaption className="mt-2 text-sm font-bold text-gold">
        — {quote.who} ז״ל
      </figcaption>
    </figure>
  );
}
