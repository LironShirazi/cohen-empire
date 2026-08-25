import Link from "next/link";
import { ResultsRefresher } from "@/components/game/results-refresher";
import { Button } from "@/components/ui/button";
import type { Race, RaceResultRow } from "@/lib/supabase/types";

/** גובה עמוד הפודיום לפי מקום — הזוכה הכי גבוה (סקיצה 2h) */
const stepHeight: Record<number, string> = {
  1: "h-[82px]",
  2: "h-[56px]",
  3: "h-[40px]",
};

const confetti = [
  { dx: "-110px", dy: "-90px", color: "var(--yellow)", delay: "0s" },
  { dx: "100px", dy: "-110px", color: "var(--brand)", delay: ".3s" },
  { dx: "-130px", dy: "30px", color: "var(--gold)", delay: ".6s" },
  { dx: "120px", dy: "40px", color: "#fff", delay: ".9s" },
  { dx: "-50px", dy: "-130px", color: "var(--brand)", delay: "1.2s" },
  { dx: "60px", dy: "110px", color: "var(--yellow)", delay: "1.5s" },
];

/**
 * שעת ההשלמה האחרונה = "חצו את הקו".
 *
 * ⚠️ אזור הזמן **קבוע ולא של השרת**: זהו רכיב שרת, וב-Vercel השרת רץ
 * ב-UTC. בלי הקיבוע הזה הכתובית הייתה מראה 13:24 במקום 16:24.
 * המירוץ הוא ביום העצמאות בישראל — אין לו אזור זמן אחר.
 */
function crossingTime(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString("he-IL", {
    timeZone: "Asia/Jerusalem",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "7 משימות · חצו ראשונים את הקו ב־16:24" — בלי החלקים שאין להם נתון */
function summarize(row: RaceResultRow, isChampion: boolean): string | null {
  const parts: string[] = [];
  if (row.stations_done > 0) {
    parts.push(
      row.stations_done === 1 ? "משימה אחת" : `${row.stations_done} משימות`
    );
  }
  const time = crossingTime(row.finished_at);
  if (time) {
    // לא-אלוף לא בהכרח "סיים" — הדירוג הוא לפי כמות משימות, וקבוצה
    // עם פחות משימות יכולה להופיע עם שעה מוקדמת יותר מזו של הזוכים
    parts.push(
      isChampion ? `חצו ראשונים את הקו ב־${time}` : `השלמה אחרונה ב־${time}`
    );
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** ריבוע החיה בצבע הקבוצה — על רקע קוסמי ולכן מעורבב עם כחול כהה */
function TeamMark({
  row,
  className,
  size,
}: {
  row: RaceResultRow;
  className?: string;
  size: string;
}) {
  return (
    <span
      className={`flex flex-none items-center justify-center rounded-card-sm border-2 ${size} ${className ?? ""}`}
      style={{
        background: `color-mix(in srgb, ${row.team_color} 30%, #0d1b3a)`,
        borderColor: row.team_color,
      }}
    >
      {row.team_animal?.split(" ")[0] ?? "🏁"}
    </span>
  );
}

/**
 * מסך הזוכים (docs/01 §6, סקיצה 2h) — הרגע שבו המירוץ נגמר.
 *
 * רכיב שרת בכוונה: כל התנועה כאן היא CSS טהור (`.cheer`,
 * `.cheer-trophy`), ואין שום דבר שהמשתמש לוחץ עליו חוץ מקישורים.
 *
 * השורות מגיעות מ-`get_race_results` (0015), שמסרב לרוץ על מירוץ חי —
 * ספירת המשימות והשעות שמוצגות כאן הן בדיוק מה שהלידרבורד מסתיר
 * כל עוד יש מתח לשמור (docs/02 §3.3).
 */
export function WinnersScreen({
  race,
  results,
}: {
  race: Race;
  results: RaceResultRow[];
}) {
  // המסך לא אמור להגיע לכאן בלי שורות (הראוט מציג מצב ריק), אבל
  // הרכיב לא סומך על זה — champion הוא הדבר הראשון שנקרא
  if (results.length === 0) return null;

  const champion = results[0];
  // האלופים הוכרזו אבל המירוץ לא נסגר — יש קבוצות שעוד רצות
  const stillRunning = race.status === "live";
  // סדר הפודיום הוא 2־1־3 משמאל לימין, ולכן המכל הזה `dir="ltr"`
  // גם בתוך עמוד RTL. מירוץ עם שתי קבוצות מקבל פודיום של שניים.
  const podium = [results[1], results[0], results[2]].filter(Boolean);
  const rest = results.slice(3);

  return (
    <main className="cosmic relative flex-1 overflow-hidden px-5 pt-12 pb-10 text-center">
      <div
        aria-hidden
        className="cheer pointer-events-none absolute start-1/2 top-[120px] size-2.5"
      >
        {confetti.map((piece, index) => (
          <i
            key={index}
            style={
              {
                "--dx": piece.dx,
                "--dy": piece.dy,
                background: piece.color,
                animationDelay: piece.delay,
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      <div className="relative mx-auto flex w-full max-w-lg flex-col gap-3">
        <span className="cheer-trophy text-5xl">🏆</span>

        <h1 className="goldtext font-display text-[40px] leading-none">
          האלופים
          <br />
          של {race.year}!
        </h1>
        <p className="-mt-1 text-sm text-[#c9d3ea]">{race.name}</p>

        {/* הזוכים — הכרטיס היחיד שמקבל מסגרת זהב */}
        {/* ⚠️ הזהב השקוף הוא inline ולא `bg-gold/15`: Tailwind v4 ממזג
            ב-oklab מול שקוף, ומעל הרקע הקוסמי התוצאה יוצאת אפורה */}
        <div
          className="mt-1 flex items-center gap-3 rounded-card border-2 border-gold p-4 text-start"
          style={{
            background: "color-mix(in srgb, var(--gold-lite) 16%, transparent)",
          }}
        >
          <TeamMark row={champion} size="size-14 text-[32px]" />
          <div className="min-w-0 flex-1">
            <b className="block truncate text-[23px] text-white">
              {champion.team_name}
            </b>
            {summarize(champion, true) ? (
              <p className="text-[13.5px] text-[#c9d3ea]">
                {summarize(champion, true)}
              </p>
            ) : null}
            {champion.members.length > 0 ? (
              <p className="mt-0.5 truncate text-[13.5px] text-gold-lite">
                {champion.members.join(" · ")}
              </p>
            ) : null}
          </div>
          <span className="text-3xl">🥇</span>
        </div>

        {podium.length > 1 ? (
          <div dir="ltr" className="mt-1.5 flex items-end justify-center gap-2">
            {podium.map((row) => (
              <div key={row.team_id} className="w-[88px]">
                <div className="text-[26px]">
                  {row.team_animal?.split(" ")[0] ?? "🏁"}
                </div>
                {/* השם ולא רק החיה: `animal` הוא רשות, ובלעדיו כל
                    העמודים היו מציגים את אותו 🏁 */}
                <div className="truncate text-[11.5px] text-[#c9d3ea]">
                  {row.team_name}
                </div>
                <div
                  className={`flex items-center justify-center rounded-t-[10px] border font-display ${stepHeight[row.rank]} ${
                    row.rank === 1
                      ? "border-gold text-[28px] text-gold-lite"
                      : "border-white/20 bg-white/10 text-[22px] text-[#c9d3ea]"
                  }`}
                  style={
                    row.rank === 1
                      ? {
                          background:
                            "color-mix(in srgb, var(--gold-lite) 22%, transparent)",
                        }
                      : undefined
                  }
                >
                  {row.rank}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {/* מקום 4 ומטה — הפודיום לא מציג אותם, אבל במשפחה הזו רצות
            גם חמש קבוצות ואף אחת לא צריכה להיעלם מהתוצאות */}
        {rest.length > 0 ? (
          <ul className="mt-1 flex flex-col gap-2 text-start">
            {rest.map((row) => (
              <li
                key={row.team_id}
                className="flex items-center gap-3 rounded-card-sm border border-white/15 bg-white/5 px-3.5 py-2.5"
              >
                <span className="w-6 text-center font-display text-lg text-[#c9d3ea]">
                  {row.rank}
                </span>
                <TeamMark row={row} size="size-9 text-lg" />
                <div className="min-w-0 flex-1">
                  <b className="block truncate text-[15px]">{row.team_name}</b>
                  {summarize(row, false) ? (
                    <span className="text-xs text-[#c9d3ea]">
                      {summarize(row, false)}
                    </span>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : null}

        <p className="mt-1 text-[13.5px] text-[#c9d3ea] opacity-90">
          המירוץ נוסף אוטומטית להיכל התהילה 🏛
        </p>

        {/* המסך הזה נדלק כשהאלופים מוכרזים — ואז שאר הקבוצות עדיין
            בשטח ומסיימות את המסלול שלהן (docs/02 §3.11). מי שיושב כאן
            כבר חזר, והרשימה שלמטה עוד תגדל */}
        {stillRunning ? (
          <>
            <p className="rounded-card-sm border border-white/15 bg-white/5 px-3.5 py-2.5 text-[13.5px] text-[#c9d3ea]">
              🚶 שאר הקבוצות עוד בדרך — הן ממשיכות את המסלול, והרשימה
              כאן מתעדכנת לבד.
            </p>
            <ResultsRefresher />
          </>
        ) : null}

        <div className="mt-2 flex flex-col gap-2.5">
          {/* הסקיצה מציעה "תמונת הזוכים לגלריה" — הגלריה היא של
              המשפחה ולא של המירוץ (CLAUDE.md §10), ולכן זה קישור
              אליה ולא העלאה מיוחדת שתיצור אלבום סמוי */}
          <Link href="/gallery">
            <Button variant="accent" size="lg" className="w-full">
              📸 תמונת הזוכים לגלריה
            </Button>
          </Link>
          <Link href="/hall-of-fame">
            <Button variant="secondary" className="w-full">
              🏆 היכל התהילה
            </Button>
          </Link>
          <Link
            href="/"
            className="mt-1 text-sm font-bold text-[#c9d3ea] hover:text-yellow"
          >
            לדף הבית
          </Link>
        </div>
      </div>
    </main>
  );
}
