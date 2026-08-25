import type { HallOfFameRow } from "@/lib/supabase/types";
import { Card } from "@/components/ui/card";

/**
 * היכל התהילה (docs/04 §1) — מקביל ל-
 * `claude-design/design-system/components/hall-of-fame.html` ולסקיצה 2d.
 *
 * השורות מגיעות משני מקורות באותה טבלה: `finish_race` בסיום מירוץ,
 * והזנה ידנית של מנהל-על לשנים שקדמו לאפליקציה. **בכוונה אין הבחנה
 * ויזואלית ביניהן** — למשפחה 2009 ו-2026 הן אותה מסורת.
 */
export function HallOfFameList({ rows }: { rows: HallOfFameRow[] }) {
  const [champion, ...rest] = rows;

  return (
    <>
      <ChampionCard row={champion} />

      {rest.length > 0 ? (
        <div className="mt-3 flex flex-col gap-2.5">
          {rest.map((row) => (
            <YearRow key={row.id} row={row} />
          ))}
        </div>
      ) : null}

      <Stats rows={rows} />
    </>
  );
}

/** האלופים האחרונים — תמיד על רקע קוסמי וזהב */
function ChampionCard({ row }: { row: HallOfFameRow }) {
  return (
    <div className="cosmic flex items-center gap-3.5 rounded-card p-5 shadow-navy">
      <span className="flex-none text-[40px]">🏆</span>
      <div className="min-w-0">
        <p className="font-display text-[22px] text-gold-lite">
          אלופי {row.year}
        </p>
        <p className="truncate text-xl font-extrabold">{row.team_name}</p>
        {row.members.length > 0 ? (
          <p className="mt-0.5 text-sm text-[#c9d3ea]">
            {row.members.join(", ")}
          </p>
        ) : null}
      </div>
      <Photo row={row} className="ms-auto size-16" />
    </div>
  );
}

function YearRow({ row }: { row: HallOfFameRow }) {
  return (
    <div
      className="flex items-center gap-3 rounded-card border border-line border-s-8 bg-surface p-3.5 shadow-card"
      // צבע הקבוצה מגיע מהשורה ולכן inline ולא קלאס
      style={{ borderInlineStartColor: row.team_color ?? "var(--line)" }}
    >
      <span className="min-w-[52px] flex-none font-display text-[22px] text-brand">
        {row.year}
      </span>
      <Photo row={row} className="size-13" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold">{row.team_name}</p>
        {row.members.length > 0 ? (
          <p className="truncate text-sm text-muted">
            {row.members.join(", ")}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function Photo({ row, className }: { row: HallOfFameRow; className: string }) {
  if (!row.photo_url) {
    return (
      <span
        aria-hidden
        className={`flex flex-none items-center justify-center rounded-card-sm bg-bg-2 text-xl opacity-40 ${className}`}
      >
        📷
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={row.photo_url}
      alt={`הקבוצה הזוכה ${row.year}`}
      className={`flex-none rounded-card-sm border border-line object-cover ${className}`}
    />
  );
}

/**
 * "סטטיסטיקות משעשעות" (docs/04 §1) — מחושבות כאן מהשורות שכבר נטענו.
 * שתי ספירות על עשרות שורות לא מצדיקות view או RPC.
 */
function Stats({ rows }: { rows: HallOfFameRow[] }) {
  const wins = new Map<string, number>();
  for (const row of rows) {
    wins.set(row.team_name, (wins.get(row.team_name) ?? 0) + 1);
  }
  const [topName, topWins] = [...wins.entries()].sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="mt-4 flex gap-2.5">
      <Card className="flex-1 p-3.5 text-center">
        <b className="block font-display text-[26px] text-brand">
          {rows.length}
        </b>
        <span className="text-sm text-muted">שנות מירוץ</span>
      </Card>
      {/* שיאן זכיות מוצג רק כשמישהו באמת ניצח יותר מפעם אחת — אחרת
          זו "עובדה" ריקה שמצביעה על שורה אקראית */}
      {topWins > 1 ? (
        <Card className="flex-1 p-3.5 text-center">
          <b className="block font-display text-[26px] text-brand">{topWins}</b>
          <span className="text-sm text-muted">זכיות · {topName}</span>
        </Card>
      ) : null}
    </div>
  );
}
