import Link from "next/link";
import { redirect } from "next/navigation";
import { WinnerWatcher } from "@/components/game/winner-watcher";
import { TeamHeader } from "@/components/team-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { PageShell } from "@/components/ui/page";
import { UnreadBadge } from "@/components/notifications/unread-badge";
import {
  getMyMembership,
  getUnreadNotifications,
  getUser,
  hasFinishedRoute,
  raceStatusLabel,
} from "@/lib/data";

export default async function TeamPage() {
  const user = await getUser();
  if (!user) redirect("/join");

  const membership = await getMyMembership();
  if (!membership) redirect("/join");

  const { team, race } = membership;
  const [unread, teamDone] = await Promise.all([
    getUnreadNotifications(team.id),
    hasFinishedRoute(team.id),
  ]);

  // ⚠️ **לא** "יש אלופים" אלא "מותר לי לדעת שיש אלופים" (docs/02 §3.11):
  // כל עוד המירוץ רץ, רק קבוצה שסיימה את המסלול שלה רואה את הכפתור.
  // קבוצה שעוד בשטח לא אמורה לדעת שההכרעה נפלה — היא אמורה לסיים.
  const showWinners =
    race.status === "finished" ||
    (race.winner_declared_at !== null && teamDone);

  return (
    <PageShell className="flex flex-col gap-4">
      <TeamHeader team={team} subtitle={race.name} />

      <div className="flex justify-center">
        <Chip tone={race.status === "live" ? "brand" : "muted"}>
          {race.status === "live" ? "🔴 " : ""}
          {raceStatusLabel[race.status]}
        </Chip>
      </div>

      {/* סיימנו — מסך הזוכים הוא הכפתור הראשי, לא מהלך המשחק */}
      {showWinners ? (
        <Link href="/winners">
          <Button size="lg" variant="accent" className="w-full">
            🏆 מסך הזוכים
          </Button>
        </Link>
      ) : null}

      <Link href="/team/play">
        <Button
          size="lg"
          variant={showWinners ? "secondary" : "primary"}
          className="w-full"
        >
          ▶️ מהלך המשחק
        </Button>
      </Link>

      <Link href="/team/chat" className="relative block">
        <Button size="lg" variant="secondary" className="w-full">
          💬 צ׳אט קבוצתי
        </Button>
        <UnreadBadge
          unread={unread}
          className="absolute -top-1.5 -end-1.5 shadow-card"
        />
      </Link>

      <div className="grid grid-cols-2 gap-3">
        <Link href="/leaderboard">
          <Button variant="navy" className="w-full">
            🏅 לוח מובילים
          </Button>
        </Link>
        <Link href="/teams">
          <Button variant="accent" className="w-full">
            👥 כל הקבוצות
          </Button>
        </Link>
      </div>

      <Card className="text-sm text-muted">
        הקבוצה כולה רואה בדיוק את אותו מסך — המצב נשמר בשרת, אז לא משנה
        מי מחזיק את הטלפון.
      </Card>

      <Link
        href="/"
        className="text-center text-sm font-bold text-muted hover:text-brand"
      >
        לדף הבית
      </Link>

      {race.status === "live" ? (
        <WinnerWatcher raceId={race.id} teamDone={teamDone} />
      ) : null}
    </PageShell>
  );
}
