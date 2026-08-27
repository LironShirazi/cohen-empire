"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  archiveRaceAction,
  declareWinnerAction,
  finishRaceAction,
  setRaceStatusAction,
} from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { FormError } from "@/components/ui/page";
import type { RaceStatus } from "@/lib/supabase/types";

const nextStep: Partial<Record<RaceStatus, { status: RaceStatus; label: string }>> = {
  draft: { status: "open", label: "פתיחת הרשמה 🔓" },
  open: { status: "live", label: "יוצאים לדרך! 🏁" },
};

/**
 * ⚠️ **הכרזת זוכים וסיום מירוץ הם שני כפתורים שונים** (docs/02 §3.11).
 *
 * עד 0015 זו הייתה לחיצה אחת, והיא נעלה את כל מי שעוד היה בשטח:
 * `arrive_at_station` ו-`complete_station` דורשים `status = 'live'`,
 * אז קבוצה באמצע המסלול קיבלה "המירוץ לא פעיל" ונשארה בלי סיום.
 *
 * עכשיו: מכריזים כשהראשונים חוזרים (המירוץ ממשיך), וסוגרים כשכולם
 * חזרו. הכפתור השני נשאר "כבד" (navy) בכוונה — הוא זה שנועל.
 */
export function RaceControls({
  raceId,
  status,
  winnerDeclared,
}: {
  raceId: string;
  status: RaceStatus;
  winnerDeclared: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(fn: () => Promise<{ error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (result.error) setError(result.error);
    });
  }

  const step = nextStep[status];
  const winnersHref = `/winners?race=${raceId}`;

  return (
    <Card className="flex flex-col gap-3">
      <h2 className="font-display text-h2">מצב המירוץ</h2>

      {step ? (
        <Button
          size="lg"
          disabled={pending}
          onClick={() => run(() => setRaceStatusAction(raceId, step.status))}
        >
          {step.label}
        </Button>
      ) : null}

      {status === "live" && !winnerDeclared ? (
        <>
          <Button
            size="lg"
            variant="accent"
            disabled={pending}
            onClick={() =>
              run(async () => {
                const result = await declareWinnerAction(raceId);
                // המנהל רואה בדיוק את המסך שהקבוצות שסיימו מוקפצות אליו
                if (!result.error) router.push(winnersHref);
                return result;
              })
            }
          >
            🏆 הכרזת הזוכים
          </Button>
          <p className="text-sm text-muted">
            לוחצים כשהקבוצה הראשונה חוזרת לבית סבא. <b>המירוץ ממשיך לרוץ</b> —
            מי שעוד בשטח מסיים את המסלול שלו ואפילו לא יודע שכבר יש אלופים.
          </p>
        </>
      ) : null}

      {status === "live" && winnerDeclared ? (
        <>
          <div className="flex items-center justify-between gap-2">
            <Chip tone="yellow">🏆 האלופים הוכרזו</Chip>
            <Link
              href={winnersHref}
              className="text-sm font-bold text-brand hover:underline"
            >
              למסך הזוכים →
            </Link>
          </div>
          <Button
            size="lg"
            variant="navy"
            disabled={pending}
            onClick={() => run(() => finishRaceAction(raceId))}
          >
            🏁 סיום המירוץ לכולם
          </Button>
          {/* פאנל האזהרה האדום מסקיצה 3i. הפעולה הזו נועלת את המשחק
              לכולם, והיא נלחצת באמצע ארוחה רועשת — היא צריכה להיראות
              אחרת מכל שאר הכפתורים במסך. */}
          <p className="rounded-card-sm border border-brand bg-brand/14 px-3.5 py-3 text-sm">
            רק כשכל הקבוצות חזרו. הסגירה <b>נועלת את המשחק</b> — מרגע זה אי
            אפשר להגיע לתחנה או להשלים משימה.
          </p>
        </>
      ) : null}

      {status === "finished" || status === "archived" ? (
        <Link href={winnersHref}>
          <Button variant="accent" className="w-full">
            🏆 מסך הזוכים
          </Button>
        </Link>
      ) : null}

      {status === "finished" ? (
        <>
          <p className="text-sm text-muted">
            אחרי הארכוב המירוץ נעול לעריכה — לכולם, כולל לכם. הוא יישאר
            לקריאה בהיכל התהילה.
          </p>
          <Button
            variant="secondary"
            disabled={pending}
            onClick={() => run(() => archiveRaceAction(raceId))}
          >
            ארכוב המירוץ 📦
          </Button>
        </>
      ) : null}

      {status === "archived" ? (
        <p className="text-sm text-muted">המירוץ בארכיון — לקריאה בלבד.</p>
      ) : null}

      <FormError>{error}</FormError>
    </Card>
  );
}
