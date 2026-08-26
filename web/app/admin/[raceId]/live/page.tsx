import { notFound, redirect } from "next/navigation";
import { BroadcastForm } from "@/components/admin/broadcast-form";
import { LiveMap } from "@/components/admin/live-map";
import { LivePanel } from "@/components/admin/live-panel";
import { LeaderboardList } from "@/components/leaderboard-list";
import { Card } from "@/components/ui/card";
import { AdminBody, AdminHeader } from "@/components/admin/admin-header";
import {
  getApprovalQueue,
  getLeaderboard,
  getRace,
  getRaceStations,
  getRaceTeams,
  getTeamLocations,
  getTeamPositions,
  getUser,
  isRaceAdmin,
} from "@/lib/data";

export default async function AdminLivePage(
  props: PageProps<"/admin/[raceId]/live">,
) {
  const user = await getUser();
  if (!user) redirect("/");

  const { raceId } = await props.params;
  if (!(await isRaceAdmin(raceId))) notFound();

  const race = await getRace(raceId);
  if (!race) notFound();

  const [approvals, positions, leaderboard, teams, locations, stations] =
    await Promise.all([
      getApprovalQueue(raceId),
      getTeamPositions(raceId),
      getLeaderboard(raceId),
      getRaceTeams(raceId),
      getTeamLocations(raceId),
      getRaceStations(raceId),
    ]);

  return (
    <main className="flex flex-1 flex-col">
      <AdminHeader
        title="🔴 מהלך המירוץ"
        back={`/admin/${raceId}`}
        backLabel="ללוח הבקרה"
      />
      <AdminBody className="flex flex-col gap-4">
        {race.status !== "live" ? (
          <Card className="text-sm text-muted">
            המירוץ עדיין לא במצב &quot;רץ&quot; — אפשר להתכונן כאן, אבל המשתתפים
            לא יוכלו לפתוח משימות עד שתלחצו על &quot;יוצאים לדרך&quot;.
          </Card>
        ) : null}

        <h2 className="font-display text-h2">איפה כולם עכשיו</h2>
        <LiveMap teams={locations} stations={stations} />

        <BroadcastForm
          raceId={raceId}
          teams={teams}
          locked={race.status === "archived"}
        />

        <LivePanel approvals={approvals} positions={positions} />

        {/* ⚠️ `LeaderboardList` עוצב למסך קוסמי (סקיצה 2b) — טקסט לבן
            על שורות שקופות. כאן הוא יושב על גוף בהיר, ובלי המעטפת
            הכהה הוא לבן-על-לבן. סקיצה 3g ממילא מייעדת למסך ה-Live
            רקע קוסמי מלא; זו המנה הראשונה שלו. */}
        <div className="cosmic rounded-card px-4 py-5 shadow-navy">
          <h2 className="goldtext mb-3 font-display text-h2">לוח מובילים</h2>
          <LeaderboardList rows={leaderboard} />
        </div>
      </AdminBody>
    </main>
  );
}
