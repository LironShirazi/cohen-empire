"use client";

import { useActionState, useState, useTransition } from "react";
import {
  deleteStationAction,
  saveStationAction,
  type AdminFormState,
} from "@/app/admin/actions";
import { StationMap, type MapPoint } from "@/components/admin/station-map";
import { TaskMediaField } from "@/components/admin/task-media-field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, SelectField, TextareaField } from "@/components/ui/field";
import { FormError } from "@/components/ui/page";
import type { CompletionType, Station } from "@/lib/supabase/types";

const completionLabels: Record<CompletionType, string> = {
  admin_approve: "אישור המנהל התורן",
  secret_code: "קוד סודי שמחכה בתחנה",
  photo_upload: "צילום והעלאת תמונה",
  auto: "אוטומטי — מספיק להגיע",
};

export function StationEditor({
  raceId,
  station,
  others = [],
  fallbackCenter,
  onDone,
}: {
  raceId: string;
  station?: Station;
  others?: MapPoint[];
  fallbackCenter: { lat: number; lng: number };
  onDone?: () => void;
}) {
  const [state, action, pending] = useActionState(
    saveStationAction.bind(null, raceId),
    {} as AdminFormState
  );
  const [point, setPoint] = useState({
    lat: station?.lat ?? fallbackCenter.lat,
    lng: station?.lng ?? fallbackCenter.lng,
  });
  const [radius, setRadius] = useState(station?.radius_m ?? 75);
  const [completionType, setCompletionType] = useState<CompletionType>(
    station?.completion_type ?? "admin_approve"
  );
  const [deleting, startDelete] = useTransition();

  return (
    <Card className="flex flex-col gap-3">
      <form action={action} className="flex flex-col gap-3">
        {station ? <input type="hidden" name="id" value={station.id} /> : null}
        <input type="hidden" name="lat" value={point.lat} />
        <input type="hidden" name="lng" value={point.lng} />

        <Field
          label="שם התחנה"
          name="name"
          defaultValue={station?.name ?? ""}
          placeholder="המאפייה של שישי"
          hint="נחשף למשתתפים רק אחרי שהם מגיעים — כדי לא לפוצץ את הרמז"
          required
        />

        <TextareaField
          label="הרמז"
          name="clue"
          defaultValue={station?.clue ?? ""}
          placeholder="״המקום שבו סבא קנה פיתות חמות בכל שישי…״"
          hint="זה מה שהקבוצה רואה בדרך לתחנה"
        />

        <TextareaField
          label="המשימה"
          name="task_text"
          defaultValue={station?.task_content?.text ?? ""}
          placeholder="מצאו את הלחמנייה הכי גדולה וצלמו את כל הקבוצה נוגסת בה"
          hint="נפתח רק כשהשרת מאמת שהגעתם לרדיוס"
        />

        <TaskMediaField
          raceId={raceId}
          defaultUrl={station?.task_content?.media}
        />

        <TextareaField
          label="סיפור הרקע של המקום"
          name="backstory"
          defaultValue={station?.backstory ?? ""}
          placeholder="למה המקום הזה משמעותי למשפחה"
        />

        <div>
          <span className="mb-1.5 block text-[15px] font-bold">
            מיקום ורדיוס נעילה
          </span>
          <StationMap
            lat={point.lat}
            lng={point.lng}
            radiusM={radius}
            others={others}
            onChange={(lat, lng) => setPoint({ lat, lng })}
          />
          <p className="mt-1 text-sm text-muted">
            מקישים על המפה או גוררים את הסיכה. מיקום נוכחי:{" "}
            <span dir="ltr">
              {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
            </span>
          </p>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-[15px] font-bold">
            רדיוס נעילה: {radius} מ׳
          </span>
          <input
            type="range"
            name="radius_m"
            min={20}
            max={300}
            step={5}
            value={radius}
            onChange={(event) => setRadius(Number(event.target.value))}
            className="w-full accent-brand"
          />
          <span className="mt-1 block text-sm text-muted">
            דיוק GPS גרוע מרחיב את הסף אוטומטית — אין צורך להגזים ברדיוס.
          </span>
        </label>

        <SelectField
          label="איך מסמנים השלמה"
          name="completion_type"
          value={completionType}
          onChange={(event) =>
            setCompletionType(event.target.value as CompletionType)
          }
        >
          {Object.entries(completionLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </SelectField>

        {completionType === "secret_code" ? (
          <Field
            label="הקוד הסודי"
            name="secret_code"
            defaultValue={station?.secret_code ?? ""}
            placeholder="פיתה"
            hint="השוואה בשרת, בלי רגישות לאותיות גדולות ורווחים"
          />
        ) : null}

        <FormError>{state.error}</FormError>

        <div className="flex gap-2">
          <Button type="submit" disabled={pending} className="flex-1">
            {pending ? "שומרים…" : station ? "שמירה" : "הוספת תחנה"}
          </Button>
          {onDone ? (
            <Button type="button" variant="quiet" onClick={onDone}>
              ביטול
            </Button>
          ) : null}
        </div>
      </form>

      {station ? (
        <Button
          variant="quiet"
          disabled={deleting}
          onClick={() => {
            if (!confirm(`למחוק את התחנה "${station.name}"?`)) return;
            startDelete(async () => {
              await deleteStationAction(station.id);
            });
          }}
        >
          מחיקת התחנה
        </Button>
      ) : null}
    </Card>
  );
}
