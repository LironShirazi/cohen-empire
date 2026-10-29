import { Card } from "@/components/ui/card";
import type { AppStats } from "@/lib/supabase/types";

/**
 * שמות המסכים כפי שהמשפחה מכירה אותם. הנתיבים כבר מנורמלים ב-
 * `PageViewTracker` (uuid ← `[id]`), ולכן מספיק מפתח אחד לכל ראוט.
 * נתיב שלא כאן מוצג כמו שהוא — עדיף מאשר להסתיר מסך חדש.
 */
const pageNames: Record<string, string> = {
  "/": "דף הבית",
  "/join": "הצטרפות — קוד משחק",
  "/join/team": "הצטרפות — קוד קבוצה",
  "/waiting": "המתנה לאישור",
  "/team": "מסך הקבוצה",
  "/team/play": "מהלך המשחק",
  "/team/chat": "צ'אט הקבוצה",
  "/teams": "הקבוצות",
  "/leaderboard": "לוח המובילים",
  "/winners": "מסך הזוכים",
  "/hall-of-fame": "היכל התהילה",
  "/family-tree": "העץ המשפחתי",
  "/gallery": "הגלריה",
  "/gallery/[id]": "אלבום בגלריה",
  "/admin": "ניהול",
  "/admin/content": "ניהול — תוכן משפחתי",
  "/admin/stats": "ניהול — סטטיסטיקות",
  "/admin/[id]": "ניהול — לוח בקרה",
  "/admin/[id]/teams": "ניהול — קבוצות",
  "/admin/[id]/stations": "ניהול — תחנות",
  "/admin/[id]/live": "ניהול — מירוץ חי",
  "/admin/[id]/chat": "ניהול — צ'אטים",
  "/admin/[id]/chat/[id]": "ניהול — צ'אט קבוצה",
  "/auth/error": "שגיאת התחברות",
};

// "2026-10-29" ← "29.10". השרת כבר החזיר יום בשעון ירושלים
function dayLabel(day: string) {
  const [, month, date] = day.slice(0, 10).split("-");
  return `${Number(date)}.${Number(month)}`;
}

// "2026-10-29T15:45:09.35" ← "29.10 · 15:45" (או "היום · 15:45")
function seenLabel(ts: string, today: string) {
  const time = ts.slice(11, 16);
  const day = ts.slice(0, 10);
  return `${day === today ? "היום" : dayLabel(day)} · ${time}`;
}

export function AppStatsView({ stats }: { stats: AppStats }) {
  const { summary } = stats;
  const today = stats.daily.at(-1)?.day ?? "";

  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="כניסות למסכים" value={summary.views} />
        <StatTile label="מכשירים שונים" value={summary.visitors} />
        <StatTile label="בני משפחה מחוברים" value={summary.users} />
        <StatTile
          label="היום"
          value={summary.today_visitors}
          hint={`${summary.today_views} כניסות`}
        />
      </div>

      <div className="grid gap-3.5 md:grid-cols-2">
        <Card className="flex flex-col gap-3">
          <h2 className="font-display text-h2">מכשירים לפי יום</h2>
          <Bars
            bars={stats.daily.map((d) => ({
              key: d.day,
              value: d.visitors,
              title: `${dayLabel(d.day)} · ${d.visitors} מכשירים · ${d.views} כניסות`,
            }))}
            ticks={[
              dayLabel(stats.daily[0]?.day ?? today),
              dayLabel(today),
            ]}
          />
        </Card>

        <Card className="flex flex-col gap-3">
          <h2 className="font-display text-h2">שעות השיא</h2>
          <Bars
            bars={stats.hourly.map((h) => ({
              key: String(h.hour),
              value: h.views,
              title: `${String(h.hour).padStart(2, "0")}:00 · ${h.views} כניסות`,
            }))}
            ticks={["00:00", "06:00", "12:00", "18:00", "23:00"]}
          />
        </Card>
      </div>

      <div className="grid gap-3.5 md:grid-cols-2">
        <Card className="flex flex-col gap-3">
          <h2 className="font-display text-h2">מי נכנס</h2>
          {stats.people.length === 0 ? (
            <p className="text-small text-muted">
              עוד אף בן משפחה מחובר לא נכנס בטווח הזה.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {stats.people.map((person) => (
                <li
                  key={person.user_id}
                  className="flex items-center gap-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">
                      {person.full_name ?? "ללא שם"}
                    </p>
                    <p className="text-small text-muted">
                      {person.views} כניסות · {person.days_active}{" "}
                      {person.days_active === 1 ? "יום" : "ימים"}
                    </p>
                  </div>
                  <span className="shrink-0 text-small text-muted">
                    {seenLabel(person.last_seen, today)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {stats.anonymous_visitors > 0 ? (
            <p className="text-small text-muted">
              ועוד {stats.anonymous_visitors}{" "}
              {stats.anonymous_visitors === 1 ? "מכשיר" : "מכשירים"} שלא
              התחברו
            </p>
          ) : null}
        </Card>

        <Card className="flex flex-col gap-3">
          <h2 className="font-display text-h2">המסכים הנצפים</h2>
          {stats.pages.length === 0 ? (
            <p className="text-small text-muted">אין עוד כניסות בטווח הזה.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {stats.pages.map((page) => (
                <li key={page.path} className="flex items-center gap-3 py-2.5">
                  <span className="min-w-0 flex-1 truncate">
                    {pageNames[page.path] ?? (
                      <span dir="ltr">{page.path}</span>
                    )}
                  </span>
                  <span className="shrink-0 text-small text-muted">
                    {page.views} כניסות · {page.visitors} מכשירים
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <Card tight className="flex flex-col gap-0.5">
      <span className="text-small text-muted">{label}</span>
      <span className="font-display text-[34px] leading-tight">
        {value.toLocaleString("he-IL")}
      </span>
      {hint ? <span className="text-small text-muted">{hint}</span> : null}
    </Card>
  );
}

/**
 * גרף עמודות של סדרה אחת — div-ים ולא ספריית גרפים: שני גרפים במסך
 * אחד לא מצדיקים תלות, ורכיב שרת לא צריך JS בדפדפן.
 *
 * ⚠️ **הציר רץ משמאל לימין גם ב-RTL** (`dir="ltr"`), כמו השעון בספירה
 * לאחור: זמן נקרא כאן משמאל לימין, והיום האחרון בקצה הימני.
 * העמודה כולה היא אזור הריחוף (`title`), לא רק החלק הצבוע — אחרת
 * יום עם כניסה אחת הוא מטרה בגובה שני פיקסלים.
 */
function Bars({
  bars,
  ticks,
}: {
  bars: { key: string; value: number; title: string }[];
  ticks: string[];
}) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  const dense = bars.length > 40;

  return (
    <div dir="ltr" className="flex flex-col gap-1.5">
      <div
        className={`flex h-32 items-end border-b border-line ${dense ? "gap-px" : "gap-0.5"}`}
      >
        {bars.map((bar) => (
          <div
            key={bar.key}
            title={bar.title}
            className="flex h-full flex-1 items-end"
          >
            {bar.value > 0 ? (
              <div
                className="w-full rounded-t bg-brand"
                style={{ height: `${Math.max(3, (bar.value / max) * 100)}%` }}
              />
            ) : null}
          </div>
        ))}
      </div>
      <div className="flex justify-between text-xs text-muted">
        {ticks.map((tick) => (
          <span key={tick}>{tick}</span>
        ))}
      </div>
    </div>
  );
}
