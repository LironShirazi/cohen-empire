import Link from "next/link";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { HallOfFameList } from "@/components/family/hall-of-fame-list";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageShell } from "@/components/ui/page";
import { getHallOfFame, getProfile, getUser } from "@/lib/data";

export const metadata = {
  title: "🏆 היכל התהילה — אימפריית כהן",
};

/**
 * היכל התהילה (docs/01 §7, docs/04 §1) — זוכי כל השנים.
 *
 * הטבלה מתמלאת משני מקורות: `finish_race` (0002) מוסיף שורה בסיום כל
 * מירוץ באפליקציה, ומנהל-על מזין ידנית ב-`/admin/content` את השנים
 * שקדמו לה. ההיסטוריה נאספת מהמשפחה ולכן המסך הזה יתחיל ריק.
 *
 * מחוברים בלבד: מדיניות הקריאה היא `to authenticated` מאז 0001.
 */
export default async function HallOfFamePage() {
  const user = await getUser();

  if (!user) {
    return (
      <PageShell className="flex flex-col items-center gap-6 text-center">
        <span className="text-6xl">🏆</span>
        <h1 className="font-display text-h1 text-brand">היכל התהילה</h1>
        <Card className="flex flex-col items-center gap-4">
          <p className="text-muted">
            עשרים שנות זוכים שמורות לבני המשפחה — צריך להתחבר כדי לראות אותן.
          </p>
          <GoogleSignInButton next="/hall-of-fame" />
        </Card>
      </PageShell>
    );
  }

  const [rows, profile] = await Promise.all([getHallOfFame(), getProfile()]);

  return (
    <main className="flex flex-1 flex-col">
      {/* כותרת קוסמית (סקיצה 2d) — היכל התהילה הוא ראוט יעד ולא מסך
          שירות, והזהב הוא כל הנקודה שלו */}
      <header className="cosmic rounded-b-[26px] px-5 pt-14 pb-6 text-center shadow-navy">
        <p className="text-[40px]">🏆</p>
        <h1 className="goldtext font-display text-4xl leading-[1.05]">
          היכל התהילה
        </h1>
        <p className="mt-1.5 text-small text-on-navy-muted">
          {rows.length > 0
            ? `${rows.length} שנות מירוץ בבית סבא וסבתא`
            : "כל שנות המירוץ בבית סבא וסבתא"}
        </p>
      </header>

      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-3 px-5 pt-4 pb-10">
        {rows.length === 0 ? (
          /* מצב ריק **מוצג** — בניגוד לציטוט. זה ראוט יעד: מי שנכנס
           בכוונה חייב לקבל תשובה ולא מסך ריק */
          <Card className="text-center">
            <span className="text-5xl">🏛️</span>
            <p className="mt-3 text-lg font-bold">היכל התהילה עוד מתמלא</p>
            <p className="mt-1 text-muted">
              עשרים שנות מירוץ נאספות עכשיו מהמשפחה. כל מירוץ חדש שמסתיים
              באפליקציה נכנס לכאן לבד 🏁
            </p>
            {profile?.is_owner ? (
              <Link href="/admin/content" className="mt-4 inline-block">
                <Button variant="secondary">הזנת שנים מההיסטוריה</Button>
              </Link>
            ) : null}
          </Card>
        ) : (
          <HallOfFameList rows={rows} />
        )}

        <Link
          href="/"
          className="mt-auto pt-4 text-center text-small font-bold text-muted hover:text-brand"
        >
          → לדף הבית
        </Link>
      </div>
    </main>
  );
}
