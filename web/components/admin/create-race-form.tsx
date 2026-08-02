"use client";

import { useActionState } from "react";
import { createRaceAction, type AdminFormState } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { FormError } from "@/components/ui/page";

export function CreateRaceForm() {
  const [state, action, pending] = useActionState(
    createRaceAction,
    {} as AdminFormState
  );
  const nextYear = new Date().getFullYear() + 1;

  return (
    <form action={action} className="flex flex-col gap-3">
      <Field
        label="שנה"
        name="year"
        type="number"
        defaultValue={nextYear}
        required
      />
      <Field
        label="שם המירוץ"
        name="name"
        defaultValue={`המירוץ למיליון ${nextYear}`}
        required
      />
      <Field
        label="זינוק (תאריך ושעה)"
        name="starts_at"
        type="datetime-local"
        required
      />
      <div className="grid grid-cols-2 gap-3">
        <Field
          label="קו רוחב הזינוק"
          name="start_lat"
          type="number"
          step="any"
          placeholder="31.42"
          hint="בית סבא"
        />
        <Field
          label="קו אורך"
          name="start_lng"
          type="number"
          step="any"
          placeholder="34.59"
        />
      </div>

      <FormError>{state.error}</FormError>
      <Button size="lg" type="submit" disabled={pending}>
        {pending ? "יוצרים…" : "יצירת מירוץ 🏁"}
      </Button>
    </form>
  );
}
