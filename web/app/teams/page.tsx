import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { PageHeader, PageShell } from "@/components/ui/page";
import {
  getActiveRace,
  getMyMembership,
  getRaceTeams,
  getUser,
} from "@/lib/data";

/** כל משתתף רשאי לראות את כל הקבוצות והרכבן (docs/01-requirements.md §5) */
export default async function TeamsPage() {
  const user = await getUser();
  if (!user) redirect("/join");

  const membership = await getMyMembership();
  const race = membership?.race ?? (await getActiveRace());

  if (!race) {
    return (
      <PageShell>
        <PageHeader title="👥 הקבוצות" back="/" backLabel="לדף הבית" />
        <Card className="text-center text-muted">אין כרגע מירוץ פעיל.</Card>
      </PageShell>
    );
  }

  const teams = await getRaceTeams(race.id);

  return (
    <PageShell className="flex flex-col gap-4">
      <PageHeader
        title="👥 הקבוצות"
        back={membership ? "/team" : "/"}
        backLabel={membership ? "לקבוצה" : "לדף הבית"}
      />

      {teams.length === 0 ? (
        <Card className="text-center text-muted">
          המנהל התורן עוד לא יצר קבוצות.
        </Card>
      ) : null}

      {teams.map((team) => (
        <Card
          key={team.id}
          className="flex flex-col gap-3"
          style={{ borderInlineStartWidth: 8, borderInlineStartColor: team.color }}
        >
          <div className="flex items-center gap-3">
            <span
              className="flex size-14 flex-none items-center justify-center rounded-2xl text-3xl"
              style={{ background: `color-mix(in srgb, ${team.color} 15%, #fff)` }}
            >
              {team.animal?.split(" ")[0] ?? "🏁"}
            </span>
            <div>
              <p className="font-display text-xl">{team.name}</p>
              <p className="text-sm text-muted">
                {team.members.length} חברי קבוצה
              </p>
            </div>
            <Chip className="ms-auto">קוד {team.join_code}</Chip>
          </div>

          {team.members.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {team.members.map((member) => (
                <span
                  key={member.id}
                  className="rounded-full border border-line bg-bg px-3 py-1 text-sm font-semibold"
                >
                  {member.display_name}
                </span>
              ))}
            </div>
          ) : null}
        </Card>
      ))}
    </PageShell>
  );
}
