import Link from "next/link";
import { redirect } from "next/navigation";
import { CreateRaceForm } from "@/components/admin/create-race-form";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { AdminBody, AdminHeader } from "@/components/admin/admin-header";
import {
  getMyAdminRaces,
  getProfile,
  getUser,
  raceStatusLabel,
} from "@/lib/data";

export default async function AdminHomePage() {
  const user = await getUser();
  if (!user) redirect("/");

  const [profile, races] = await Promise.all([getProfile(), getMyAdminRaces()]);

  return (
    <main className="flex flex-1 flex-col">
      <AdminHeader title="🛠️ ניהול" back="/" backLabel="לדף הבית" />
      <AdminBody className="flex flex-col gap-4">
        {/* מנהל-על רואה כאן את **כל** המירוצים (0018) ולא רק את אלה
            שמונה אליהם, ולכן גם המצב הריק שלו אחר: אצלו זה אומר
            שעוד לא נוצר מירוץ, ולא שלא מינו אותו */}
        {races.length === 0 ? (
          <Card className="text-center text-muted">
            {profile?.is_owner
              ? "עוד לא נוצר אף מירוץ. פותחים את הראשון למטה 👇"
              : "אתם עוד לא מנהלים תורנים של אף מירוץ."}
          </Card>
        ) : null}

        {races.map((race) => (
          <Link key={race.id} href={`/admin/${race.id}`}>
            <Card className="flex items-center gap-3">
              <div>
                <p className="font-display text-xl">{race.name}</p>
                <p className="text-sm text-muted">שנת {race.year}</p>
              </div>
              <Chip
                className="ms-auto"
                tone={race.status === "live" ? "brand" : "muted"}
              >
                {raceStatusLabel[race.status]}
              </Chip>
            </Card>
          </Link>
        ))}

        {profile?.is_owner ? (
          <>
            <Link href="/admin/content">
              <Card className="flex items-center gap-3">
                <span className="text-2xl">🏛️</span>
                <div>
                  <p className="font-display text-xl">תוכן משפחתי</p>
                  <p className="text-sm text-muted">
                    משפטי סבא וסבתא · היכל התהילה
                  </p>
                </div>
              </Card>
            </Link>

            <Card className="flex flex-col gap-4">
              <h2 className="font-display text-h2">מירוץ חדש</h2>
              <CreateRaceForm />
            </Card>
          </>
        ) : (
          <Card className="text-sm text-muted">
            יצירת מירוץ חדש שמורה למנהל-על. אם צריך למנות אתכם — פנו אליו.
          </Card>
        )}
      </AdminBody>
    </main>
  );
}
