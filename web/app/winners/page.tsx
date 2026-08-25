import Link from "next/link";
import { redirect } from "next/navigation";
import { WinnersScreen } from "@/components/game/winners-screen";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader, PageShell } from "@/components/ui/page";
import { getRace, getRaceResults, getUser, getWinnersRace } from "@/lib/data";

export const metadata = {
  title: "🏆 מסך הזוכים — אימפריית כהן",
};

/**
 * מסך הזוכים (docs/01 §6, סקיצה 2h) — ראוט קבוע ולא רגע חולף.
 *
 * עד עכשיו ההכרזה חיה רק ב-state המקומי של `RaceControls` אצל המנהל
 * שלחץ על הכפתור, ונעלמה ברענון. כאן היא נקראת מהשרת בכל פעם מחדש,
 * ולכן אפשר לחזור אליה, לשלוח קישור, ולהגיע אליה מאוחר יותר.
 *
 * `RaceFinishWatcher` מקפיץ לכאן את כל מי שבמירוץ ברגע שהמנהל מסיים
 * אותו — זה הרגע שבשבילו נבנה המסך.
 *
 * `?race=<id>` הוא לקישור של המנהל: הוא לא בהכרח משתתף במירוץ שהוא
 * מנהל, ובלי הפרמטר `getWinnersRace` הייתה מחזירה לו את המירוץ
 * האחרון לפי שנה — לא בהכרח זה שהוא בדיוק סיים. אין כאן שאלת
 * הרשאה: `get_race_results` בודקת בעצמה שהמירוץ הסתיים.
 */
export default async function WinnersPage(props: PageProps<"/winners">) {
  const user = await getUser();
  if (!user) redirect("/join");

  const { race: requested } = await props.searchParams;
  const race =
    typeof requested === "string"
      ? await getRace(requested)
      : await getWinnersRace();
  const results = race ? await getRaceResults(race.id) : [];

  if (!race || results.length === 0) {
    return (
      <PageShell>
        <PageHeader title="🏆 מסך הזוכים" back="/" backLabel="לדף הבית" />
        <Card className="text-center">
          <span className="text-5xl">🏁</span>
          <p className="mt-3 text-lg font-bold">עוד אין זוכים להכריז עליהם</p>
          <p className="mt-1 text-muted">
            המסך הזה נדלק ברגע שמנהל המירוץ מכריז על הסיום. בינתיים —
            כל השנים הקודמות מחכות בהיכל התהילה.
          </p>
          <Link href="/hall-of-fame" className="mt-4 inline-block">
            <Button variant="secondary">🏆 להיכל התהילה</Button>
          </Link>
        </Card>
      </PageShell>
    );
  }

  return <WinnersScreen race={race} results={results} />;
}
