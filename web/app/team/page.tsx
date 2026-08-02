import Link from "next/link";
import { redirect } from "next/navigation";
import { TeamHeader } from "@/components/team-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { PageShell } from "@/components/ui/page";
import { getMyMembership, getUser, raceStatusLabel } from "@/lib/data";

export default async function TeamPage() {
  const user = await getUser();
  if (!user) redirect("/join");

  const membership = await getMyMembership();
  if (!membership) redirect("/join");

  const { team, race } = membership;

  return (
    <PageShell className="flex flex-col gap-4">
      <TeamHeader team={team} subtitle={race.name} />

      <div className="flex justify-center">
        <Chip tone={race.status === "live" ? "brand" : "muted"}>
          {race.status === "live" ? "🔴 " : ""}
          {raceStatusLabel[race.status]}
        </Chip>
      </div>

      <Link href="/team/play">
        <Button size="lg" className="w-full">
          ▶️ מהלך המשחק
        </Button>
      </Link>

      {/* צ'אט קבוצתי — שלב 2 בתוכנית הפיתוח (docs/05-roadmap.md) */}
      <Button size="lg" variant="secondary" className="w-full" disabled>
        💬 צ׳אט קבוצתי — בקרוב
      </Button>

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
    </PageShell>
  );
}
