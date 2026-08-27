import Link from "next/link";
import { redirect } from "next/navigation";
import { QuoteCard } from "@/components/family/quote-card";
import { WinnerWatcher } from "@/components/game/winner-watcher";
import { TeamBanner } from "@/components/team/team-banner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { UnreadBadge } from "@/components/notifications/unread-badge";
import {
  getLeaderboard,
  getMyMembership,
  getRandomQuote,
  getUnreadNotifications,
  getUser,
  hasFinishedRoute,
} from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import type { GameState } from "@/lib/supabase/types";

export default async function TeamPage() {
  const user = await getUser();
  if (!user) redirect("/join");

  const membership = await getMyMembership();
  if (!membership) redirect("/join");

  const { team, race } = membership;
  const supabase = await createClient();

  const [unread, teamDone, rows, quote, stateResult] = await Promise.all([
    getUnreadNotifications(team.id),
    hasFinishedRoute(team.id),
    getLeaderboard(race.id),
    getRandomQuote(),
    supabase.rpc("get_team_state", { p_team_id: team.id }),
  ]);

  const state = stateResult.error ? null : (stateResult.data as GameState);
  const myRank = rows.find((row) => row.team_id === team.id)?.rank;

  // ⚠️ **לא** "יש אלופים" אלא "מותר לי לדעת שיש אלופים" (docs/02 §3.11):
  // כל עוד המירוץ רץ, רק קבוצה שסיימה את המסלול שלה רואה את הכפתור.
  // קבוצה שעוד בשטח לא אמורה לדעת שההכרעה נפלה — היא אמורה לסיים.
  const showWinners =
    race.status === "finished" ||
    (race.winner_declared_at !== null && teamDone);

  // שורת המשנה של הכפתור הראשי. `station.position` הוא מספר התחנה
  // שהשרת כבר הסכים לגלות — לא נגזר מכלום בקליינט.
  const playNote =
    state === null
      ? race.name
      : state.state === "finished"
        ? "המסלול שלכם הושלם 🏁"
        : state.state === "no_stations"
          ? "המירוץ עוד בהכנות"
          : state.state === "awaiting_approval"
            ? "ממתינים לאישור המנהל"
            : state.station
              ? `${state.state === "clue" ? "בדרך לתחנה" : "תחנה"} ${state.station.position}`
              : race.name;

  return (
    <main className="flex flex-1 flex-col">
      <TeamBanner team={team} rank={myRank} note={race.name} />

      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-3 px-5 pt-4 pb-10">
        {/* סיימנו — מסך הזוכים הוא הכפתור הראשי, לא מהלך המשחק */}
        {showWinners ? (
          <Link href="/winners">
            <Button variant="accent" className="min-h-[88px] w-full flex-col gap-0.5 text-2xl">
              🏆 מסך הזוכים
              <span className="text-small font-semibold opacity-85">
                האלופים של {race.year}
              </span>
            </Button>
          </Link>
        ) : null}

        <Link href="/team/play">
          <Button
            variant={showWinners ? "secondary" : "primary"}
            className="min-h-[88px] w-full flex-col gap-0.5 text-2xl"
          >
            ▶️ מהלך המשחק
            <span className="text-small font-semibold opacity-85">{playNote}</span>
          </Button>
        </Link>

        <Link href="/team/chat" className="relative block">
          <Button variant="navy" className="min-h-[88px] w-full flex-col gap-0.5 text-2xl">
            💬 צ׳אט קבוצתי
            <span className="text-small font-semibold opacity-85">
              {unread.length > 0
                ? `${unread.length} הודעות חדשות`
                : "כל הקבוצה והמנהל התורן"}
            </span>
          </Button>
          <UnreadBadge
            unread={unread}
            className="absolute -top-1.5 -end-1.5 shadow-card"
          />
        </Link>

        <MiniLeaderboard rows={rows} myTeamId={team.id} />

        <Link href="/teams">
          <Button variant="quiet" className="w-full">
            👥 כל הקבוצות והרכבן
          </Button>
        </Link>

        <div className="mt-auto pt-2">
          <QuoteCard quote={quote} />
        </div>

        <Link
          href="/"
          className="text-center text-small font-bold text-muted hover:text-brand"
        >
          לדף הבית
        </Link>
      </div>

      {race.status === "live" ? (
        <WinnerWatcher raceId={race.id} teamDone={teamDone} />
      ) : null}
    </main>
  );
}

/**
 * הצצה ללוח המובילים בתוך מסך הקבוצה (סקיצה 2a) — שלושת הראשונים
 * והשורה שלנו.
 *
 * ⚠️ **בלי "5 משימות" שהסקיצה מציגה לכל שורה.** זו בדיוק ההתקדמות
 * ש-docs/02 §3.3 אוסר לחשוף, ו-`get_leaderboard` ממילא לא מחזירה
 * אותה. אותה סתירה כמו בסקיצה 2b — ראו `leaderboard-list.tsx`.
 */
function MiniLeaderboard({
  rows,
  myTeamId,
}: {
  rows: { rank: number; team_id: string; team_name: string; team_animal: string | null }[];
  myTeamId: string;
}) {
  if (rows.length === 0) return null;

  // שלושת הראשונים, ואם אנחנו לא ביניהם — גם השורה שלנו
  const top = rows.slice(0, 3);
  const mine = rows.find((row) => row.team_id === myTeamId);
  const shown = mine && !top.includes(mine) ? [...top, mine] : top;

  return (
    <Card tight className="flex flex-col gap-2">
      <div className="flex items-baseline gap-2">
        <h2 className="font-display text-h2">🏅 לוח מובילים</h2>
        <span className="ms-auto text-small text-muted">מתעדכן חי</span>
      </div>

      {shown.map((row) => {
        const isMine = row.team_id === myTeamId;
        return (
          <div
            key={row.team_id}
            className={`flex items-center gap-2 text-[15.5px] ${
              isMine ? "-mx-1.5 rounded-lg bg-brand-soft px-1.5 py-1" : ""
            }`}
          >
            <b className={`w-5.5 ${isMine ? "text-brand" : "text-muted"}`}>
              {row.rank}
            </b>
            <span className={isMine ? "font-bold" : ""}>
              {row.team_animal?.split(" ")[0]} {row.team_name}
            </span>
          </div>
        );
      })}

      <Link href="/leaderboard">
        <Button variant="quiet" className="w-full">
          לטבלה המלאה
        </Button>
      </Link>
    </Card>
  );
}
