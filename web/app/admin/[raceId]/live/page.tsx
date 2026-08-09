import { notFound, redirect } from "next/navigation";
import { LivePanel } from "@/components/admin/live-panel";
import { LeaderboardList } from "@/components/leaderboard-list";
import { Card } from "@/components/ui/card";
import { PageHeader, PageShell } from "@/components/ui/page";
import {
  getApprovalQueue,
  getLeaderboard,
  getRace,
  getTeamPositions,
  getUser,
  isRaceAdmin,
} from "@/lib/data";

export default async function AdminLivePage(
  props: PageProps<"/admin/[raceId]/live">
) {
  const user = await getUser();
  if (!user) redirect("/");

  const { raceId } = await props.params;
  if (!(await isRaceAdmin(raceId))) notFound();

  const race = await getRace(raceId);
  if (!race) notFound();

  const [approvals, positions, leaderboard] = await Promise.all([
    getApprovalQueue(raceId),
    getTeamPositions(raceId),
    getLeaderboard(raceId),
  ]);

  return (
    <PageShell className="flex flex-col gap-4">
      <PageHeader
        title="🔴 מהלך המירוץ"
        back={`/admin/${raceId}`}
        backLabel="ללוח הבקרה"
      />

      {race.status !== "live" ? (
        <Card className="text-sm text-muted">
          המירוץ עדיין לא במצב &quot;רץ&quot; — אפשר להתכונן כאן, אבל
          המשתתפים לא יוכלו לפתוח משימות עד שתלחצו על &quot;יוצאים לדרך&quot;.
        </Card>
      ) : null}

      <LivePanel approvals={approvals} positions={positions} />

      <h2 className="font-display text-xl">לוח מובילים</h2>
      <LeaderboardList rows={leaderboard} />
    </PageShell>
  );
}
