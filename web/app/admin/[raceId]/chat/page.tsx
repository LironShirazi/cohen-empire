import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { PageHeader, PageShell } from "@/components/ui/page";
import { getRace, getRaceTeams, getUser, isRaceAdmin } from "@/lib/data";

export default async function AdminChatIndexPage(
  props: PageProps<"/admin/[raceId]/chat">
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
      <PageHeader
        title="💬 צ'אט עם הקבוצות"
        back={`/admin/${raceId}`}
        backLabel="ללוח הבקרה"
      />

      <Card className="text-sm text-muted">
        המנהל התורן חבר אוטומטית בצ׳אט של כל קבוצה במירוץ שלו — ההודעות
        שלכם מסומנות שם 📣.
      </Card>

      {teams.length === 0 ? (
        <Card className="text-sm text-muted">
          עוד אין קבוצות במירוץ הזה.
        </Card>
      ) : null}

      {teams.map((team) => (
        <Link key={team.id} href={`/admin/${raceId}/chat/${team.id}`}>
          <div
            className="flex items-center gap-3 rounded-card border border-line bg-surface p-4 shadow-card"
            style={{
              borderInlineStartWidth: 8,
              borderInlineStartColor: team.color,
            }}
          >
            <span
              className="flex size-12 flex-none items-center justify-center rounded-2xl text-2xl"
              style={{
                background: `color-mix(in srgb, ${team.color} 15%, #fff)`,
              }}
            >
              {team.animal?.split(" ")[0] ?? "🏁"}
            </span>
            <div>
              <p className="font-display text-lg">{team.name}</p>
              <p className="text-sm text-muted">
                {team.members.length} משתתפים
              </p>
            </div>
            <span className="ms-auto text-xl">💬</span>
          </div>
        </Link>
      ))}
    </PageShell>
  );
}
