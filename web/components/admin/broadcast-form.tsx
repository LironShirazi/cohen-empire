"use client";

import { useState, useTransition } from "react";
import { broadcastAction } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SelectField, TextareaField } from "@/components/ui/field";
import { FormError } from "@/components/ui/page";
import type { TeamWithMembers } from "@/lib/data";

const ALL = "all";

/**
 * הודעת רוחב מהמנהל התורן (docs/04 §4).
 *
 * ההודעה נשלחת אל **הצ'אט** של קבוצות היעד ולא למסך נפרד — שם
 * המשפחה כבר קוראת, שם היא נשמרת, ושם היא מסומנת 📣. מה שהמסך הזה
 * מוסיף מעל "להיכנס לצ'אט של כל קבוצה ולהדביק" הוא השליחה לכולן
 * בבת אחת + התראה לכל משתתף.
 */
export function BroadcastForm({
  raceId,
  teams,
  locked = false,
}: {
  raceId: string;
  teams: TeamWithMembers[];
  /** מירוץ בארכיון — ה-RPC היה חוסם ממילא, אבל עם הודעה פחות ברורה */
  locked?: boolean;
}) {
  const [body, setBody] = useState("");
  const [target, setTarget] = useState(ALL);
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function send() {
    const text = body.trim();
    if (!text || pending) return;

    setError(null);
    setSent(null);
    startTransition(async () => {
      const result = await broadcastAction(
        raceId,
        text,
        target === ALL ? null : target
      );
      if (result.error) {
        setError(result.error);
        return;
      }
      setBody("");
      setSent(
        result.teams === 1
          ? "ההודעה נשלחה לצ'אט של הקבוצה 📣"
          : `ההודעה נשלחה לצ'אט של ${result.teams} הקבוצות 📣`
      );
    });
  }

  return (
    <Card className="flex flex-col gap-3">
      <h2 className="font-display text-xl">📣 הודעה מהמנהל התורן</h2>

      {locked ? (
        <p className="text-sm text-muted">
          המירוץ בארכיון — הצ׳אטים פתוחים לקריאה, אבל אי אפשר לשלוח.
        </p>
      ) : teams.length === 0 ? (
        <p className="text-sm text-muted">עוד אין קבוצות במירוץ הזה.</p>
      ) : (
        <>
          <SelectField
            label="למי שולחים"
            value={target}
            onChange={(event) => setTarget(event.target.value)}
            disabled={pending}
          >
            <option value={ALL}>כל הקבוצות ({teams.length})</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
                {team.animal ? ` ${team.animal.split(" ")[0]}` : ""}
              </option>
            ))}
          </SelectField>

          <TextareaField
            label="ההודעה"
            hint="נכנסת לצ'אט של הקבוצה כהודעה מהמנהל, וקופצת אצל המשתתפים כבאנר."
            value={body}
            onChange={(event) => setBody(event.target.value)}
            disabled={pending}
            placeholder="למשל: מזג האוויר משתגע — נפגשים בבית סבא בעוד 20 דקות ☔"
          />

          <Button
            className="w-full"
            disabled={pending || !body.trim()}
            onClick={send}
          >
            {pending ? "שולח…" : "שליחה"}
          </Button>

          {sent ? (
            <p className="rounded-card-sm bg-yellow-soft px-3.5 py-2.5 text-sm font-bold">
              {sent}
            </p>
          ) : null}
          <FormError>{error}</FormError>
        </>
      )}
    </Card>
  );
}
