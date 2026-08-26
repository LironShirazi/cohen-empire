import type { HTMLAttributes } from "react";

/**
 * המשטח של ‎.card, בלי הריפוד — לאלמנטים שחייבים להיות תג מסוים
 * ולכן לא יכולים להיות `<Card>`. היום זה `<summary>` במסך התחנות:
 * הוא חייב להיות ילד ישיר של `<details>`, ו-div היה שובר את
 * ההיפתחות. הוא שיכפל את המחרוזת ידנית — כאן היא מקור אחד.
 */
export const cardSurface =
  "rounded-card border border-line bg-surface shadow-card";

/**
 * מקביל ל-.card ב-design-system/styles.css.
 *
 * `tight` הוא ‎.card-tight של ה-DS (padding 12 במקום 20) — לשורות
 * ברשימה, שם ריפוד מלא הופך רשימה בת שש קבוצות למגילה.
 */
export function Card({
  tight = false,
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement> & { tight?: boolean }) {
  return (
    <div
      className={`${cardSurface} ${tight ? "p-3" : "p-5"} ${className}`}
      {...props}
    />
  );
}

/**
 * ‎.note ב-DS — ההערה המוסגרת ("המשימה תיחשף רק כשתגיעו פיזית 🤫").
 * היא חזרה משוכפלת בכמה מסכים כמחרוזת Tailwind ידנית; כאן היא רכיב
 * אחד, כדי שהצבע והגודל לא ייגזרו מחדש בכל פעם.
 */
export function Note({
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-card-sm border border-line bg-bg-2 px-3.5 py-3 text-small text-muted ${className}`}
      {...props}
    />
  );
}
