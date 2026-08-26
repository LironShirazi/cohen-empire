import Image from "next/image";
import type { Quote } from "@/lib/supabase/types";

/**
 * משפט של סבא או סבתא (docs/01 §7, docs/04 §1) — מקביל ל-
 * `claude-design/design-system/components/quote-card.html`.
 *
 * ⚠️ **מחזיר `null` כשאין משפט, וזה העיקר.** המשפטים נאספים מהמשפחה
 * לאורך זמן, והאפליקציה תרוץ שבועות עם טבלה ריקה. ציטוט הוא תבלין
 * אווירה ולא ישות שהמסך חייב לדווח עליה — אסור שיופיע כאן כרטיס
 * "עוד אין משפטים". זה **הפוך** מהיכל התהילה, שהוא ראוט יעד ולכן כן
 * חייב מצב ריק מוצג.
 *
 * ההגרלה עצמה נעשית ב-`getRandomQuote()` בשרת, לא כאן — ראו את
 * ההסבר על hydration ב-`lib/data.ts`.
 */
export function QuoteCard({
  quote,
  variant = "bubble",
  className = "",
}: {
  quote: Quote | null;
  variant?: "feature" | "bubble";
  className?: string;
}) {
  if (!quote) return null;

  // `who` הוא 'סבא' / 'סבתא' (0001), אבל הוא טקסט חופשי ולא enum —
  // ולכן בודקים הכלה ולא שוויון
  const isGranny = quote.who.includes("סבתא");

  if (variant === "feature") {
    return (
      <figure className={`w-full rounded-card bg-yellow text-ink ${className}`}>
        <div className="flex items-center gap-3 p-5">
          {/* הפורטרט המצויר של שניהם — הנכס האמיתי היחיד שיש בריפו.
              מי אמר את המשפט כתוב בשורת הייחוס ממילא (סקיצה 1a).

              ⚠️ הקופסה **מלבנית ולא ריבועית**, לפי יחס הדיו של הקובץ
              (781×1153 ≈ 0.677). כשהיא הייתה `size-[72px]` הדמות צוירה
              44.8×66.2 ונשארו ~13px מקום מת בכל צד — כלומר המרווח
              שהעין ראתה מול הטקסט היה כפול מ-`gap-3`. */}
          <Image
            src="/brand/grandparents.png"
            alt="סבא וסבתא"
            width={114}
            height={168}
            priority
            className="h-[84px] w-[57px] flex-none object-contain"
          />
          <div className="min-w-0 flex-1 text-start">
            <span
              aria-hidden
              className="block font-display text-[44px] leading-[0.5] opacity-25"
            >
              ״
            </span>
            <blockquote className="mt-1.5 font-display text-xl leading-snug">
              {quote.text}
            </blockquote>
            <figcaption className="mt-2 text-sm font-bold">
              — {quote.who}
            </figcaption>
          </div>
        </div>
      </figure>
    );
  }

  return (
    <figure
      className={`flex w-full items-end gap-2.5 ${
        isGranny ? "" : "flex-row-reverse"
      } ${className}`}
    >
      <QuoteFace quote={quote} isGranny={isGranny} />
      <div
        className={`flex-1 rounded-card border border-line bg-surface px-4 py-3.5 text-start text-[17px] shadow-card ${
          isGranny ? "rounded-es-[4px]" : "rounded-ee-[4px]"
        }`}
      >
        <blockquote>״{quote.text}״</blockquote>
        <figcaption className="mt-1 text-sm text-muted">
          — {quote.who}
        </figcaption>
      </div>
    </figure>
  );
}

/**
 * העיגול שליד הבועה — מקביל ל-`.gp` / `.gp.granny` ב-styles.css.
 *
 * ברירת המחדל היא אימוג'י ולא תמונה, בכוונה: הפורטרט שבריפו הוא של
 * **שניהם יחד** בגוף מלא, וחיתוך שלו לעיגול 56px מציג פיסה אקראית.
 * מנהל-על שיעלה קריקטורה של סבא לבד או סבתא לבד ל-`image_url` יקבל
 * אותה כאן במקום האימוג'י.
 */
function QuoteFace({ quote, isGranny }: { quote: Quote; isGranny: boolean }) {
  if (quote.image_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={quote.image_url}
        alt={quote.who}
        className="size-14 flex-none rounded-full border-2 border-line bg-surface object-cover"
      />
    );
  }

  return (
    <span
      aria-hidden
      className={`flex size-14 flex-none items-center justify-center rounded-full border-2 text-[30px] ${
        isGranny
          ? "border-[#e9c7ec] bg-[#f6e3f7]"
          : "border-yellow-deep bg-yellow-soft"
      }`}
    >
      {isGranny ? "👵" : "👴"}
    </span>
  );
}
