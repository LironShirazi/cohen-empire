"use client";

import { useState, useTransition } from "react";
import {
  archiveRaceAction,
  finishRaceAction,
  setRaceStatusAction,
} from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormError } from "@/components/ui/page";
import type { FinishResult, RaceStatus } from "@/lib/supabase/types";

const nextStep: Partial<Record<RaceStatus, { status: RaceStatus; label: string }>> = {
  draft: { status: "open", label: "פתיחת הרשמה 🔓" },
  open: { status: "live", label: "יוצאים לדרך! 🏁" },
};

export function RaceControls({
  raceId,
  status,
}: {
  raceId: string;
  status: RaceStatus;
}) {
  const [error, setError] = useState<string | null>(null);
  const [winner, setWinner] = useState<FinishResult["winner"]>(null);
  const [pending, startTransition] = useTransition();

  function run(fn: () => Promise<{ error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (result.error) setError(result.error);
    });
  }

  const step = nextStep[status];

  return (
    <Card className="flex flex-col gap-3">
      <h2 className="font-display text-xl">מצב המירוץ</h2>

      {step ? (
        <Button
          size="lg"
          disabled={pending}
          onClick={() => run(() => setRaceStatusAction(raceId, step.status))}
        >
          {step.label}
        </Button>
      ) : null}

      {status === "live" ? (
        <Button
          size="lg"
          variant="navy"
          disabled={pending}
          onClick={() =>
            run(async () => {
              const result = await finishRaceAction(raceId);
              if (result.winner) setWinner(result.winner);
              return result;
            })
          }
        >
          סיום המירוץ והכרזת זוכים 🏆
        </Button>
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

      {winner ? (
        <div
          className="rounded-card p-4 text-center"
          style={{ background: `color-mix(in srgb, ${winner.color} 15%, #fff)` }}
        >
          <p className="text-4xl">🏆</p>
          <p className="font-display text-2xl">{winner.name}</p>
          <p className="text-sm text-muted">{winner.members.join(" · ")}</p>
        </div>
      ) : null}

      <FormError>{error}</FormError>
    </Card>
  );
}
