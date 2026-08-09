"use client";

import { useActionState, useState, useTransition } from "react";
import {
  deleteTeamAction,
  saveTeamAction,
  type AdminFormState,
} from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { FormError } from "@/components/ui/page";
import type { Team } from "@/lib/supabase/types";

// ערכת צבעי הקבוצות מ-design-system/styles.css
const teamColors = [
  "#E23D3D",
  "#2E86DE",
  "#27AE60",
  "#F39C12",
  "#8E5AC8",
  "#F1C40F",
  "#E84A8A",
  "#129C9C",
  "#9C6B3C",
  "#5DBBEB",
];

const animals = [
  "🐬 דולפינים",
  "🦁 אריות",
  "🐢 צבים",
  "🦄 חדי־קרן",
  "🦅 נשרים",
  "🐝 דבורים",
  "🐆 ברדלסים",
  "🦊 שועלים",
];

export function TeamEditor({
  raceId,
  team,
  onDone,
}: {
  raceId: string;
  team?: Team;
  onDone?: () => void;
}) {
  const [state, action, pending] = useActionState(
    saveTeamAction.bind(null, raceId),
    {} as AdminFormState
  );
  const [color, setColor] = useState(team?.color ?? teamColors[1]);
  const [animal, setAnimal] = useState(team?.animal ?? animals[0]);
  const [deleting, startDelete] = useTransition();

  return (
    <Card
      className="flex flex-col gap-3"
      style={{ borderInlineStartWidth: 8, borderInlineStartColor: color }}
    >
      <form action={action} className="flex flex-col gap-3">
        {team ? <input type="hidden" name="id" value={team.id} /> : null}
        <input type="hidden" name="color" value={color} />
        <input type="hidden" name="animal" value={animal} />

        <div className="grid grid-cols-[1fr_auto] gap-3">
          <Field
            label="שם הקבוצה"
            name="name"
            defaultValue={team?.name ?? ""}
            placeholder="הדולפינים"
            required
          />
          <Field
            label="קוד"
            name="join_code"
            defaultValue={team?.join_code ?? ""}
            inputMode="numeric"
            pattern="[0-9]{1,2}"
            maxLength={2}
            className="w-20 text-center"
            required
          />
        </div>

        <div>
          <span className="mb-1.5 block text-[15px] font-bold">צבע</span>
          <div className="flex flex-wrap gap-2">
            {teamColors.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setColor(option)}
                aria-label={`צבע ${option}`}
                aria-pressed={color === option}
                className={`size-9 rounded-full border-2 ${
                  color === option ? "border-ink ring-2 ring-ink" : "border-line"
                }`}
                style={{ background: option }}
              />
            ))}
          </div>
        </div>

        <div>
          <span className="mb-1.5 block text-[15px] font-bold">חיה מייצגת</span>
          <div className="flex flex-wrap gap-2">
            {animals.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setAnimal(option)}
                aria-pressed={animal === option}
                className={`rounded-full border-2 px-3 py-1.5 text-sm font-bold ${
                  animal === option
                    ? "border-brand bg-brand-soft text-brand"
                    : "border-line bg-white"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        <FormError>{state.error}</FormError>

        <div className="flex gap-2">
          <Button type="submit" disabled={pending} className="flex-1">
            {pending ? "שומרים…" : team ? "שמירה" : "הוספת קבוצה"}
          </Button>
          {onDone ? (
            <Button type="button" variant="quiet" onClick={onDone}>
              ביטול
            </Button>
          ) : null}
        </div>
      </form>

      {team ? (
        <Button
          variant="quiet"
          disabled={deleting}
          onClick={() => {
            if (!confirm(`למחוק את ${team.name}? זה ימחק גם את חברי הקבוצה.`)) return;
            startDelete(async () => {
              await deleteTeamAction(team.id);
            });
          }}
        >
          מחיקת הקבוצה
        </Button>
      ) : null}
    </Card>
  );
}
