"use client";

import { useState, useTransition } from "react";
import { addRaceAdminAction } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SelectField } from "@/components/ui/field";
import { FormError } from "@/components/ui/page";
import type { Profile } from "@/lib/supabase/types";

/**
 * מינוי מנהלים תורנים (docs/01-requirements.md §2, docs/04-screens-ux.md §5).
 * המנהל התורן הוא זה שמארגן את המירוץ השנה — לא בהכרח מנהל-העל.
 */
export function RaceAdmins({
  raceId,
  admins,
  candidates,
}: {
  raceId: string;
  admins: Profile[];
  candidates: Profile[];
}) {
  const [selected, setSelected] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const adminIds = new Set(admins.map((admin) => admin.id));
  const available = candidates.filter((profile) => !adminIds.has(profile.id));

  return (
    <Card className="flex flex-col gap-3">
      <h2 className="font-display text-xl">מנהלים תורנים</h2>

      <div className="flex flex-wrap gap-1.5">
        {admins.map((admin) => (
          <span
            key={admin.id}
            className="rounded-full border border-line bg-bg px-3 py-1 text-sm font-semibold"
          >
            👑 {admin.full_name ?? "מנהל"}
          </span>
        ))}
      </div>

      {available.length === 0 ? (
        <p className="text-sm text-muted">
          כל מי שנרשם לאפליקציה כבר מנהל תורן של המירוץ הזה.
        </p>
      ) : (
        <>
          <SelectField
            label="הוספת מנהל תורן"
            value={selected}
            onChange={(event) => setSelected(event.target.value)}
            hint="מנהל תורן יכול לנהל את המירוץ הזה בלבד"
          >
            <option value="">בחרו משתתף…</option>
            {available.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.full_name ?? profile.id}
              </option>
            ))}
          </SelectField>

          <Button
            variant="secondary"
            disabled={pending || !selected}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const result = await addRaceAdminAction(raceId, selected);
                if (result.error) setError(result.error);
                else setSelected("");
              });
            }}
          >
            {pending ? "ממנים…" : "מינוי 👑"}
          </Button>
        </>
      )}

      <FormError>{error}</FormError>
    </Card>
  );
}
