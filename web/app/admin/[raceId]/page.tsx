import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { JoinRequests } from "@/components/admin/join-requests";
import { RaceAdmins } from "@/components/admin/race-admins";
import { RaceControls } from "@/components/admin/race-controls";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { PageHeader, PageShell } from "@/components/ui/page";
import {
  getAllProfiles,
  getPendingRequests,
  getRace,
  getRaceAdminProfiles,
  getRaceStations,
  getRaceTeams,
  getUser,
  isRaceAdmin,
  raceStatusLabel,
} from "@/lib/data";

export default async function RaceDashboardPage(
  props: PageProps<"/admin/[raceId]">
) {
  const user = await getUser();
  if (!user) redirect("/");

  const { raceId } = await props.params;
  if (!(await isRaceAdmin(raceId))) notFound();

  const race = await getRace(raceId);
  if (!race) notFound();

  const [requests, teams, stations, admins, profiles] = await Promise.all([
    getPendingRequests(raceId),
    getRaceTeams(raceId),
    getRaceStations(raceId),
    getRaceAdminProfiles(raceId),
    getAllProfiles(),
  ]);

  return (
    <PageShell className="flex flex-col gap-4">
      <PageHeader
        title={race.name}
        back="/admin"
        backLabel="לרשימת המירוצים"
        action={
          <Chip tone={race.status === "live" ? "brand" : "muted"}>
            {raceStatusLabel[race.status]}
          </Chip>
        }
      />

      {/* קוד המשחק בענק לשיתוף (docs/04 §4) */}
      <Card className="cosmic border-none text-center shadow-navy">
        <p className="text-sm text-white/70">קוד המשחק</p>
        <p
          className="goldtext font-display text-5xl tracking-[0.2em]"
          dir="ltr"
        >
          {race.game_code}
        </p>
        <p className="mt-2 text-sm text-white/70">
          מכתיבים אותו למשתתפים — הם מזינים אותו במסך הכניסה
        </p>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Link href={`/admin/${raceId}/teams`}>
          <Button variant="accent" className="w-full">
            👥 קבוצות ({teams.length})
          </Button>
        </Link>
        <Link href={`/admin/${raceId}/stations`}>
          <Button variant="accent" className="w-full">
            📍 תחנות ({stations.length})
          </Button>
        </Link>
      </div>

      <Link href={`/admin/${raceId}/live`}>
        <Button variant="navy" size="lg" className="w-full">
          🔴 מהלך המירוץ
        </Button>
      </Link>

      <Link href={`/admin/${raceId}/chat`}>
        <Button variant="secondary" size="lg" className="w-full">
          💬 צ׳אט עם הקבוצות
        </Button>
      </Link>

      <JoinRequests requests={requests} />

      <RaceAdmins raceId={raceId} admins={admins} candidates={profiles} />

      <RaceControls raceId={raceId} status={race.status} />
    </PageShell>
  );
}
