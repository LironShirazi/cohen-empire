import { redirect } from "next/navigation";
import { HallOfFameEditor } from "@/components/admin/hall-of-fame-editor";
import { QuotesEditor } from "@/components/admin/quotes-editor";
import { AdminBody, AdminHeader } from "@/components/admin/admin-header";
import { getHallOfFame, getProfile, getQuotes, getUser } from "@/lib/data";

export const metadata = {
  title: "🏛️ תוכן משפחתי — אימפריית כהן",
};

/**
 * ניהול תוכן קבוע (docs/04 §5) — משפטי סבא וסבתא והיכל התהילה.
 *
 * ⚠️ **הראוט הוא אחות של `/admin/[raceId]` אבל אינו מירוץ.** כל שאר
 * `/admin` הוא race-scoped; התוכן הקבוע לא שייך לשום מירוץ (משפט של
 * סבא הוא של המשפחה, ושורת 2009 קדמה לאפליקציה). ב-Next קטע סטטי גובר
 * על דינמי, ו-`raceId` הוא תמיד uuid — ולכן `content` לא יתנגש לעולם
 * בזיהוי מירוץ אמיתי.
 *
 * ⚠️ **השער כאן הוא נוחות ולא אבטחה.** האכיפה היא ב-RLS: כל מדיניויות
 * הכתיבה על `quotes` ועל `hall_of_fame` דורשות `public.is_owner()`
 * (0014), וכך גם ההעלאה ל-bucket.
 */
export default async function AdminContentPage() {
  const user = await getUser();
  if (!user) redirect("/");

  const profile = await getProfile();
  if (!profile?.is_owner) redirect("/admin");

  const [quotes, rows] = await Promise.all([getQuotes(), getHallOfFame()]);

  return (
    <main className="flex flex-1 flex-col">
      <AdminHeader title="🏛️ תוכן משפחתי" back="/admin" backLabel="לניהול" />
      <AdminBody className="flex flex-col gap-8">
        <QuotesEditor quotes={quotes} />
        <HallOfFameEditor rows={rows} />
      </AdminBody>
    </main>
  );
}
