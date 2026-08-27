import Link from "next/link";
import { redirect } from "next/navigation";
import { LeaderboardList } from "@/components/leaderboard-list";
import { Card } from "@/components/ui/card";
import { PageHeader, PageShell } from "@/components/ui/page";
import {
  getActiveRace,
  getLeaderboard,
  getMyMembership,
  getUser,
} from "@/lib/data";

export default async function LeaderboardPage() {
  const user = await getUser();
  if (!user) redirect("/join");

  const membership = await getMyMembership();
  const race = membership?.race ?? (await getActiveRace());

  if (!race) {
    return (
      <PageShell>
        <PageHeader title="🏅 לוח מובילים" back="/" backLabel="לדף הבית" />
        <Card className="text-center text-muted">אין כרגע מירוץ פעיל.</Card>
      </PageShell>
    );
  }

  const rows = await getLeaderboard(race.id);
  const back = membership ? "/team" : "/";

  return (
    // מסך קוסמי מלא ולא PageShell על נייר (סקיצה 2b): הלידרבורד הוא
    // רגע דרמטי ולא מסך שירות, והוא אחד משלושת המסכים שה-DS מייעד
    // לרקע הכהה יחד עם פתיחת הרמז ומסך הזוכים.
    <main className="cosmic flex flex-1 flex-col gap-3 px-5 pt-12 pb-10 text-center">
      <h1 className="goldtext font-display text-[34px] leading-tight">
        לוח מובילים
      </h1>
      <p className="-mt-1.5 text-[13.5px] text-on-navy-muted">
        לפי סדר השלמת משימות · מתעדכן בזמן אמת
      </p>

      <div className="mt-2">
        <LeaderboardList rows={rows} myTeamId={membership?.team.id} />
      </div>

      <p className="mt-auto pt-6 text-[13px] text-on-navy-muted opacity-80">
        🤫 לא מגלים באיזו תחנה כל קבוצה — כדי לשמור על המתח
      </p>

      <Link
        href={back}
        className="text-sm font-bold text-on-navy-muted hover:text-yellow"
      >
        → {membership ? "לקבוצה" : "לדף הבית"}
      </Link>
    </main>
  );
}
