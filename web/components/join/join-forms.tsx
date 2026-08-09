"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { CodeInput } from "@/components/ui/code-input";
import { FormError } from "@/components/ui/page";
import {
  joinTeam,
  verifyGameCode,
  type JoinFormState,
} from "@/app/join/actions";

const initialState: JoinFormState = {};

export function GameCodeForm() {
  const [state, action, pending] = useActionState(verifyGameCode, initialState);

  return (
    <form action={action} className="flex flex-col gap-4">
      <CodeInput name="game_code" length={6} tone="ink" autoFocus />
      <p className="text-center text-sm text-muted">
        הקוד מופיע אצל המנהל התורן של המירוץ
      </p>
      <FormError>{state.error}</FormError>
      <Button size="lg" type="submit" disabled={pending}>
        {pending ? "בודק…" : "ממשיכים"}
      </Button>
    </form>
  );
}

export function TeamCodeForm({ gameCode }: { gameCode: string }) {
  const [state, action, pending] = useActionState(joinTeam, initialState);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="game_code" value={gameCode} />
      <CodeInput name="team_code" length={2} autoFocus />
      <p className="text-center text-sm text-muted">
        קוד הקבוצה הוא ספרה או שתיים — תשאלו את המנהל לאיזו קבוצה שובצתם
      </p>
      <FormError>{state.error}</FormError>
      <Button size="lg" type="submit" disabled={pending}>
        {pending ? "שולח בקשה…" : "מצטרפים לקבוצה"}
      </Button>
    </form>
  );
}
