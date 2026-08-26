import Link from "next/link";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { HallOfFameList } from "@/components/family/hall-of-fame-list";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader, PageShell } from "@/components/ui/page";
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
            עשרים שנות זוכים שמורות לבני המשפחה — צריך להתחבר כדי לראות
            אותן.
          </p>
          <GoogleSignInButton next="/hall-of-fame" />
        </Card>
      </PageShell>
    );
  }

  const [rows, profile] = await Promise.all([getHallOfFame(), getProfile()]);

  return (
    <PageShell>
      <PageHeader title="🏆 היכל התהילה" back="/" backLabel="לדף הבית" />

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
    </PageShell>
  );
}
