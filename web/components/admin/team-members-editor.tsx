"use client";

import { useActionState, useState, useTransition } from "react";
import {
  addManualMemberAction,
  removeMemberAction,
  type AdminFormState,
} from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { FormError } from "@/components/ui/page";
import type { Team, TeamMember } from "@/lib/supabase/types";
import { useConfirm } from "@/components/ui/confirm";
import { Icon } from "@/components/ui/icon";

/**
 * הרכב הקבוצה (docs/01 §3.4, docs/04 §4).
 *
 * שני סוגי שורות באותה רשימה: מי שהצטרף עם חשבון Google (נכנס דרך
 * אישור בקשה), ומשתתף ידני שהמנהל הוסיף — ילד קטן או מי שבלי טלפון.
 * שניהם ניתנים להסרה דרך `admin_remove_member` (0027). למשתתף רשום
 * השרת מוחק גם את בקשת ההצטרפות שלו, כך שהוא יכול לבקש מחדש — לקבוצה
 * הזו או לאחרת — כאילו מעולם לא ביקש.
 */
export function TeamMembersEditor({
  team,
  members,
}: {
  team: Team;
  members: TeamMember[];
}) {
  const [state, action, pending] = useActionState(
    addManualMemberAction.bind(null, team.id),
    {} as AdminFormState
  );
  const [removing, startRemove] = useTransition();
  const [removeError, setRemoveError] = useState<string>();
  const confirm = useConfirm();

  async function remove(member: TeamMember) {
    const ok = await confirm({
      title: "הסרה מהקבוצה",
      message: member.user_id
        ? `להסיר את ${member.display_name} מהקבוצה? אם זו טעות — אפשר לבקש להצטרף שוב עם קוד קבוצה.`
        : `להסיר את ${member.display_name} מהקבוצה?`,
      confirmLabel: "כן, להסיר",
    });
    if (!ok) return;
    setRemoveError(undefined);
    startRemove(async () => {
      const result = await removeMemberAction(member.id);
      if (result.error) setRemoveError(result.error);
    });
  }

  const removeButton = (member: TeamMember) => (
    <button
      type="button"
      disabled={removing}
      onClick={() => remove(member)}
      className="flex min-h-11 shrink-0 items-center rounded-full border-2 border-line px-4 text-sm font-bold text-muted hover:text-brand active:bg-brand-soft active:text-brand disabled:opacity-50"
    >
      הסרה
    </button>
  );

  const registered = members.filter((member) => member.user_id);
  const manual = members.filter((member) => !member.user_id);

  return (
    <Card
      className="flex flex-col gap-3"
      style={{ borderInlineStartWidth: 8, borderInlineStartColor: team.color }}
    >
      <h3 className="font-display text-lg">
        הרכב {team.name}
        <span className="ms-2 whitespace-nowrap text-sm font-normal text-muted">
          {members.length} משתתפים
        </span>
      </h3>

      {members.length === 0 ? (
        <p className="text-sm text-muted">
          עוד אין אף אחד בקבוצה. מי שיש לו טלפון מצטרף עם קוד הקבוצה
          ({team.join_code}); את השאר אפשר להוסיף כאן.
        </p>
      ) : null}

      {members.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {registered.map((member) => (
            <li
              key={member.id}
              className="flex items-center gap-2 rounded-card-sm border border-line px-3 py-2"
            >
              <span className="me-auto min-w-0 break-words font-bold">{member.display_name}</span>
              <span className="inline-flex shrink-0 items-center gap-1 text-sm text-muted">
                <Icon name="check" size={14} className="text-ok" />
                עם חשבון
              </span>
              {removeButton(member)}
            </li>
          ))}

          {manual.map((member) => (
            <li
              key={member.id}
              className="flex items-center gap-2 rounded-card-sm border border-line bg-bg-2 px-3 py-2"
            >
              <span className="me-auto min-w-0 break-words font-bold">
                {member.display_name}
                {member.birth_year ? (
                  <span className="ms-1.5 text-sm font-normal text-muted">
                    · שנת לידה {member.birth_year}
                  </span>
                ) : null}
              </span>
              {removeButton(member)}
            </li>
          ))}
        </ul>
      ) : null}

      <FormError>{removeError}</FormError>

      <form action={action} className="flex flex-col gap-3">
        {/* התווית הארוכה יושבת מעל השורה ולא בתוך התא הצר: בנייד היא
            נשברה לשתי שורות והשדה שלה ירד מתחת לשדה שנת הלידה */}
        <p className="text-[15px] font-bold">הוספת משתתף בלי טלפון</p>
        <div className="grid grid-cols-[minmax(0,1fr)_6rem] items-end gap-3">
          <Field
            label="שם"
            name="display_name"
            placeholder="יובל (בת 6)"
            required
          />
          <Field
            label="שנת לידה"
            name="birth_year"
            inputMode="numeric"
            pattern="[0-9]{4}"
            maxLength={4}
            className="text-center"
          />
        </div>

        <FormError>{state.error}</FormError>

        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "מוסיפים…" : "הוספה להרכב"}
        </Button>
      </form>
    </Card>
  );
}
