import Link from "next/link";
import { redirect } from "next/navigation";
import { WaitingWatcher } from "@/components/join/waiting-watcher";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { PageShell } from "@/components/ui/page";
import { WalkingSpinner } from "@/components/ui/walking-spinner";
import { getMyJoinRequest, getMyMembership, getUser } from "@/lib/data";

export default async function WaitingPage() {
  const user = await getUser();
  if (!user) redirect("/join");

  // אושר — לא ממתינים יותר
  if (await getMyMembership()) redirect("/team");

  const request = await getMyJoinRequest();
  if (!request) redirect("/join");

  if (request.status === "rejected") {
    return (
      <PageShell>
        <Card className="flex flex-col items-center gap-4 text-center">
          <span className="text-5xl">😕</span>
          <h1 className="font-display text-2xl">הבקשה לא אושרה</h1>
          <p className="text-muted">
            אולי שובצתם לקבוצה אחרת — אפשר לנסות שוב עם קוד קבוצה אחר.
          </p>
          <Link href="/join" className="w-full">
            <Button size="lg" className="w-full">
              ניסיון עם קוד אחר
            </Button>
          </Link>
        </Card>
      </PageShell>
    );
  }

  const team = request.team;

  return (
    <PageShell>
      <WaitingWatcher requestId={request.id} />

      <Card
        className="flex flex-col items-center gap-4 border-s-8 text-center"
        style={{ borderInlineStartColor: team.color }}
      >
        <Chip tone="yellow">⏳ ממתינים לאישור המנהל</Chip>

        <div
          className="flex size-20 items-center justify-center rounded-card-lg text-5xl"
          style={{ background: `color-mix(in srgb, ${team.color} 15%, #fff)` }}
        >
          {team.animal?.split(" ")[0] ?? "🏁"}
        </div>

        <div>
          <h1 className="font-display text-2xl">{team.name}</h1>
          <p className="text-muted">{request.race.name}</p>
        </div>

        <WalkingSpinner label="סבא וסבתא בדרך אליכם…" tone="cosmic" />

        <p className="text-sm text-muted">
          ברגע שהמנהל התורן יאשר — המסך יתחלף לבד ותיכנסו לקבוצה 🏁
        </p>
      </Card>
    </PageShell>
  );
}
