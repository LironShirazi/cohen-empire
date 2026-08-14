import type { UnreadNotification } from "@/lib/data";

/**
 * הבאדג' על כפתור הצ'אט (docs/01 §5.1, docs/04 §3) — השכבה המתמידה
 * של ההתראות: הבאנר נעלם אחרי כמה שניות, זה נשאר דלוק עד שקוראים.
 * מרונדר בשרת, ולכן הוא גם מה שמי שלא היה מחובר רואה בכניסה הבאה.
 *
 * אזכור גובר על הודעת רוחב בתצוגה: `@` הוא "קראו לי בשם" ודורש
 * תגובה אישית, ולכן הוא לא נבלע מאחורי 📣 כשיש גם וגם.
 */
export function UnreadBadge({
  unread,
  className = "",
}: {
  unread: UnreadNotification[];
  className?: string;
}) {
  if (unread.length === 0) return null;

  const mentions = unread.filter((row) => row.type === "mention").length;
  const count = mentions > 0 ? mentions : unread.length;

  return (
    <span
      className={`flex min-w-8 items-center justify-center gap-0.5 rounded-full bg-ok px-2 py-0.5 text-sm font-extrabold text-white ${className}`}
    >
      {mentions > 0 ? "@" : "📣"}
      {count > 1 ? count : ""}
    </span>
  );
}
