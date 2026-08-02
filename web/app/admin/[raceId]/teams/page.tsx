import { notFound, redirect } from "next/navigation";
import { TeamEditor } from "@/components/admin/team-editor";
import { Card } from "@/components/ui/card";
import { PageHeader, PageShell } from "@/components/ui/page";
import { getRace, getRaceTeams, getUser, isRaceAdmin } from "@/lib/data";

export default async function AdminTeamsPage(
  props: PageProps<"/admin/[raceId]/teams">
) {
  const user = await getUser();
  if (!user) redirect("/");

  const { raceId } = await props.params;
  if (!(await isRaceAdmin(raceId))) notFound();

  const race = await getRace(raceId);
  if (!race) notFound();

  const teams = await getRaceTeams(raceId);

  return (
    <PageShell className="flex flex-col gap-4">
      <PageHeader title="👥 קבוצות" back={`/admin/${raceId}`} backLabel="ללוח הבקרה" />

      {teams.map((team) => (
        <TeamEditor key={team.id} raceId={raceId} team={team} />
      ))}

      <Card className="text-sm text-muted">
        קוד הקבוצה הוא מה שהמשתתפים מזינים אחרי קוד המשחק. חלוקה אוטומטית
        מאוזנת לפי גיל ויכולת מגיעה בשלב 2.
      </Card>

      <h2 className="font-display text-xl">קבוצה חדשה</h2>
      <TeamEditor raceId={raceId} />
    </PageShell>
  );
}
