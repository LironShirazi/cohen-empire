"use client";

import { useActionState, useTransition } from "react";
import {
  addManualMemberAction,
  removeManualMemberAction,
  type AdminFormState,
} from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { FormError } from "@/components/ui/page";
import type { Team, TeamMember } from "@/lib/supabase/types";

/**
 * הרכב הקבוצה (docs/01 §3.4, docs/04 §4).
 *
 * שני סוגי שורות באותה רשימה: מי שהצטרף עם חשבון Google (נכנס דרך
 * אישור בקשה, ולכן לקריאה בלבד כאן), ומשתתף ידני שהמנהל הוסיף —
 * ילד קטן או מי שבלי טלפון. רק השני ניתן להסרה, וזה נאכף ב-RLS
 * ולא רק בממשק: הוצאת משתתף רשום הייתה משאירה אחריה בקשת הצטרפות
 * מאושרת ותוקעת אותו בלי דרך לבקש מחדש.
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

  const registered = members.filter((member) => member.user_id);
  const manual = members.filter((member) => !member.user_id);

  return (
    <Card
      className="flex flex-col gap-3"
      style={{ borderInlineStartWidth: 8, borderInlineStartColor: team.color }}
    >
      <h3 className="font-display text-lg">
        הרכב {team.name}
        <span className="ms-2 text-sm font-normal text-muted">
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
              <span className="me-auto font-bold">{member.display_name}</span>
              <span className="text-sm text-muted">📱 עם חשבון</span>
            </li>
          ))}

          {manual.map((member) => (
            <li
              key={member.id}
              className="flex items-center gap-2 rounded-card-sm border border-line bg-bg-2 px-3 py-2"
            >
              <span className="me-auto font-bold">
                {member.display_name}
                {member.birth_year ? (
                  <span className="ms-1.5 text-sm font-normal text-muted">
                    · שנת לידה {member.birth_year}
                  </span>
                ) : null}
              </span>
              <button
                type="button"
                disabled={removing}
                onClick={() => {
                  if (!confirm(`להסיר את ${member.display_name} מהקבוצה?`)) return;
                  startRemove(async () => {
                    await removeManualMemberAction(member.id);
                  });
                }}
                className="text-sm font-bold text-muted hover:text-brand disabled:opacity-50"
              >
                הסרה
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <form action={action} className="flex flex-col gap-3">
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <Field
            label="הוספת משתתף בלי טלפון"
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
            className="w-28 text-center"
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
