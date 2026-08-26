import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AdminBody, AdminHeader } from "@/components/admin/admin-header";
import { JoinRequests } from "@/components/admin/join-requests";
import { RaceAdmins } from "@/components/admin/race-admins";
import { RaceControls } from "@/components/admin/race-controls";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
  props: PageProps<"/admin/[raceId]">,
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

  const participants = teams.reduce(
    (sum, team) => sum + (team.members?.length ?? 0),
    0,
  );

  return (
    <main className="flex flex-1 flex-col">
      <AdminHeader
        title={race.name}
        back="/admin"
        meta={raceStatusLabel[race.status]}
        status={race.status}
      />

      <AdminBody>
        {/* קוד המשחק על הדגל הצהוב (סקיצה 3a) — הוא מוכתב בקול
            לחדר מלא אנשים, ולכן הוא האלמנט הכי גדול במסך */}
        <div className="flag px-4.5 py-4 text-center">
          <p className="text-[13px] font-extrabold text-ink opacity-70">
            קוד המשחק לשיתוף
          </p>
          <p
            dir="ltr"
            className="font-display text-[50px] leading-[1.1] tracking-[7px] text-ink"
          >
            {race.game_code}
          </p>
          <p className="mt-1 text-[13px] text-ink opacity-70">
            המשתתפים מזינים אותו במסך הכניסה
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <Stat value={teams.length} label="קבוצות" />
          <Stat value={participants} label="משתתפים" />
          <Stat value={stations.length} label="תחנות" />
          <Stat
            value={requests.length}
            label="ממתינים לאישור"
            highlight={requests.length > 0}
          />
        </div>

        <Link href={`/admin/${raceId}/live`}>
          <Button size="lg" className="w-full">
            🔴 מהלך המירוץ (Live)
          </Button>
        </Link>

        <div className="flex gap-2.5">
          <Link href={`/admin/${raceId}/stations`} className="flex-1">
            <Button variant="navy" className="w-full">
              📍 תחנות
            </Button>
          </Link>
          <Link href={`/admin/${raceId}/teams`} className="flex-1">
            <Button variant="navy" className="w-full">
              👥 קבוצות
            </Button>
          </Link>
        </div>

        <Link href={`/admin/${raceId}/chat`}>
          <Button variant="secondary" className="w-full">
            💬 צ׳אט עם הקבוצות
          </Button>
        </Link>

        <JoinRequests requests={requests} />

        <RaceAdmins raceId={raceId} admins={admins} candidates={profiles} />

        <RaceControls
          raceId={raceId}
          status={race.status}
          winnerDeclared={race.winner_declared_at !== null}
        />
      </AdminBody>
    </main>
  );
}

/** אריח סטטיסטיקה (סקיצה 3a). "ממתינים לאישור" מודגש בזהב כשיש בו
    ממש — זו השורה היחידה בלוח שדורשת פעולה עכשיו. */
function Stat({
  value,
  label,
  highlight = false,
}: {
  value: number;
  label: string;
  highlight?: boolean;
}) {
  return (
    <Card
      tight
      className={`text-center ${highlight ? "border-2 border-gold" : ""}`}
    >
      <p
        className={`font-display text-[30px] ${highlight ? "text-gold" : "text-brand"}`}
      >
        {value}
      </p>
      <p className="text-small text-muted">{label}</p>
    </Card>
  );
}
