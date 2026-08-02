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

  return (
    <PageShell className="flex flex-col gap-4">
      <PageHeader
        title="🏅 לוח מובילים"
        back={membership ? "/team" : "/"}
        backLabel={membership ? "לקבוצה" : "לדף הבית"}
      />

      <LeaderboardList rows={rows} />

      <Card className="text-sm text-muted">
        ⚠️ דירוג בלבד — בלי לחשוף באיזו משימה כל קבוצה נמצאת ומתוך כמה.
        שומרים על המתח עד הסוף.
      </Card>
    </PageShell>
  );
}
