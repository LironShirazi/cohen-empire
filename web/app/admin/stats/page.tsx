import Link from "next/link";
import { redirect } from "next/navigation";
import { AppStatsView } from "@/components/admin/app-stats";
import { AdminBody, AdminHeader } from "@/components/admin/admin-header";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { getAppStats, getProfile, getUser } from "@/lib/data";

export const metadata = {
  title: "📊 סטטיסטיקות — אימפריית כהן",
};

const RANGES = [7, 30, 90] as const;

/**
 * מי נכנס לאפליקציה, מתי ולאן (0020, CLAUDE.md §17).
 *
 * ⚠️ **מנהל-על בלבד, לא מנהל תורן.** הסטטיסטיקה היא על האפליקציה
 * כולה ולא על מירוץ, ומנהל תורן הוא תפקיד של שנה אחת. כמו
 * `/admin/content` — השער כאן נוחות, והאכיפה ב-`get_app_stats`.
 *
 * ⚠️ **מנהלי-העל עצמם מוחרגים כברירת מחדל**, אחרת הבדיקות שלהם
 * מנפחות כל גרף. `?owners=1` מחזיר אותם.
 */
export default async function AdminStatsPage(
  props: PageProps<"/admin/stats">
) {
  const user = await getUser();
  if (!user) redirect("/");

  const profile = await getProfile();
  if (!profile?.is_owner) redirect("/admin");

  const params = await props.searchParams;
  const requested = Number(params.days);
  const days = RANGES.find((r) => r === requested) ?? 30;
  const includeOwners = params.owners === "1";

  const stats = await getAppStats(days, includeOwners);

  const href = (d: number, owners: boolean) =>
    `/admin/stats?days=${d}${owners ? "&owners=1" : ""}`;

  return (
    <main className="flex flex-1 flex-col">
      <AdminHeader
        title="📊 סטטיסטיקות"
        back="/admin"
        backLabel="לניהול"
        size="wide"
      />
      <AdminBody size="wide" className="flex flex-col gap-3.5">
        <div className="flex flex-wrap items-center gap-2">
          {RANGES.map((r) => (
            <Link key={r} href={href(r, includeOwners)}>
              <Chip tone={r === days ? "brand" : "muted"}>{r} ימים</Chip>
            </Link>
          ))}
          <Link href={href(days, !includeOwners)} className="ms-auto">
            <Chip tone={includeOwners ? "brand" : "muted"}>
              {includeOwners ? "✓ " : ""}כולל מנהלי-על
            </Chip>
          </Link>
        </div>

        {stats ? (
          <AppStatsView stats={stats} />
        ) : (
          <Card className="text-center text-muted">
            לא הצלחנו לטעון את הסטטיסטיקה. אם המיגרציה 0020 עוד לא הורצה —
            זה הזמן.
          </Card>
        )}
      </AdminBody>
    </main>
  );
}
