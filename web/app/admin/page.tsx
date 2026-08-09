import Link from "next/link";
import { redirect } from "next/navigation";
import { CreateRaceForm } from "@/components/admin/create-race-form";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { PageHeader, PageShell } from "@/components/ui/page";
import { getMyAdminRaces, getProfile, getUser, raceStatusLabel } from "@/lib/data";

export default async function AdminHomePage() {
  const user = await getUser();
  if (!user) redirect("/");

  const [profile, races] = await Promise.all([getProfile(), getMyAdminRaces()]);

  return (
    <PageShell className="flex flex-col gap-4">
      <PageHeader title="🛠️ ניהול" back="/" backLabel="לדף הבית" />

      {races.length === 0 ? (
        <Card className="text-center text-muted">
          אתם עוד לא מנהלים תורנים של אף מירוץ.
        </Card>
      ) : null}

      {races.map((race) => (
        <Link key={race.id} href={`/admin/${race.id}`}>
          <Card className="flex items-center gap-3">
            <div>
              <p className="font-display text-xl">{race.name}</p>
              <p className="text-sm text-muted">שנת {race.year}</p>
            </div>
            <Chip className="ms-auto" tone={race.status === "live" ? "brand" : "muted"}>
              {raceStatusLabel[race.status]}
            </Chip>
          </Card>
        </Link>
      ))}

      {profile?.is_owner ? (
        <Card className="flex flex-col gap-4">
          <h2 className="font-display text-xl">מירוץ חדש</h2>
          <CreateRaceForm />
        </Card>
      ) : (
        <Card className="text-sm text-muted">
          יצירת מירוץ חדש שמורה למנהל-על. אם צריך למנות אתכם — פנו אליו.
        </Card>
      )}
    </PageShell>
  );
}
