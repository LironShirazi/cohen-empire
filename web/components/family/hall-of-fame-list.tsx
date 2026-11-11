import type { HallOfFameRow } from "@/lib/supabase/types";
import { Card } from "@/components/ui/card";
import { HallOfFameRowActions } from "@/components/family/hall-of-fame-row-actions";
import { HallOfFamePhoto } from "@/components/family/hall-of-fame-photo";
import { Icon } from "@/components/ui/icon";

/**
 * היכל התהילה (docs/04 §1) — מקביל ל-
 * `claude-design/design-system/components/hall-of-fame.html` ולסקיצה 2d.
 *
 * השורות מגיעות משני מקורות באותה טבלה: `finish_race` בסיום מירוץ,
 * והזנה ידנית של מנהל-על לשנים שקדמו לאפליקציה. **בכוונה אין הבחנה
 * ויזואלית ביניהן** — למשפחה 2009 ו-2026 הן אותה מסורת.
 */
export function HallOfFameList({
  rows,
  canEdit = false,
}: {
  rows: HallOfFameRow[];
  /** מנהל-על — מציג ✏️ (עריכה ומחיקה) על כל שורה */
  canEdit?: boolean;
}) {
  // ⚠️ הרכיב מקבל `HallOfFameRow[]` ולא מבטיח כלום על אורכו. הקורא
  // היחיד היום בודק ריקנות לפניו, אבל הפירוק למטה (`[champion,
  // ...rest]` ו-`sort(...)[0]`) קורס על מערך ריק — והקורא הבא לא
  // יידע שהוא חייב לבדוק.
  if (rows.length === 0) return null;

  const [champion, ...rest] = rows;

  return (
    <>
      <ChampionCard row={champion} canEdit={canEdit} />

      {rest.length > 0 ? (
        <div className="mt-3 flex flex-col gap-2.5">
          {rest.map((row) => (
            <YearRow key={row.id} row={row} canEdit={canEdit} />
          ))}
        </div>
      ) : null}

      <Stats rows={rows} />
    </>
  );
}

/** האלופים האחרונים — תמיד על רקע קוסמי וזהב */
function ChampionCard({
  row,
  canEdit,
}: {
  row: HallOfFameRow;
  canEdit: boolean;
}) {
  return (
    <div className="cosmic flex items-center gap-3.5 rounded-card p-5 shadow-navy">
      <Icon name="trophy" size={40} className="text-gold-lite" />
      <div className="min-w-0">
        <p className="font-display text-[22px] text-gold-lite">
          אלופי {row.year}
        </p>
        <p className="truncate text-xl font-extrabold">{row.team_name}</p>
        {row.members.length > 0 ? (
          <p className="mt-0.5 text-sm text-on-navy-muted">
            {row.members.join(", ")}
          </p>
        ) : null}
      </div>
      <HallOfFamePhoto row={row} className="ms-auto size-16" />
      {canEdit ? <HallOfFameRowActions row={row} tone="dark" /> : null}
    </div>
  );
}

function YearRow({ row, canEdit }: { row: HallOfFameRow; canEdit: boolean }) {
  return (
    <div
      className="flex items-center gap-3 rounded-card border border-line border-s-8 bg-surface p-3.5 shadow-card"
      // צבע הקבוצה מגיע מהשורה ולכן inline ולא קלאס
      style={{ borderInlineStartColor: row.team_color ?? "var(--line)" }}
    >
      <span className="min-w-[52px] flex-none font-display text-[22px] text-brand">
        {row.year}
      </span>
      <HallOfFamePhoto row={row} className="size-13" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold">{row.team_name}</p>
        {row.members.length > 0 ? (
          <p className="truncate text-sm text-muted">
            {row.members.join(", ")}
          </p>
        ) : null}
      </div>
      {canEdit ? <HallOfFameRowActions row={row} /> : null}
    </div>
  );
}

/**
 * "סטטיסטיקות משעשעות" (docs/04 §1) — מחושבות כאן מהשורות שכבר נטענו.
 * ספירה אחת על עשרות שורות לא מצדיקה view או RPC.
 */
function Stats({ rows }: { rows: HallOfFameRow[] }) {
  const wins = new Map<string, number>();
  for (const row of rows) {
    wins.set(row.team_name, (wins.get(row.team_name) ?? 0) + 1);
  }
  const [topName, topWins] = [...wins.entries()].sort((a, b) => b[1] - a[1])[0];
  // שיאן זכיות מוצג רק כשמישהו באמת ניצח יותר מפעם אחת — אחרת זו
  // "עובדה" ריקה שמצביעה על שורה אקראית. ספירת השנים הוסרה בכוונה.
  if (topWins < 2) return null;

  return (
    <div className="mt-4 flex gap-2.5">
      <Card className="flex-1 p-3.5 text-center">
        <b className="block font-display text-[26px] text-brand">{topWins}</b>
        <span className="text-sm text-muted">זכיות · {topName}</span>
      </Card>
    </div>
  );
}
