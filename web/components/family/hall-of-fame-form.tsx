"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { FormError } from "@/components/ui/page";
import { createClient } from "@/lib/supabase/client";
import { deleteFamilyImage, uploadFamilyImage } from "@/lib/family-content";
import type { HallOfFameRow } from "@/lib/supabase/types";

/**
 * טופס שנה בהיכל התהילה — אותו טופס להוספה (בלי `row`) ולעריכה (עם).
 * למנהל-על בלבד; האכיפה היא RLS + `grant update` ברמת העמודה (0014).
 *
 * ⚠️ **`race_id` לא נשלח מכאן ואי אפשר לשנות אותו** — הוא מחוץ ל-
 * `grant update`. הוא מה שמבדיל שורה של המערכת משורה מהזיכרון, ולכן
 * עריכת שורה שנרשמה ממירוץ משאירה אותה "של המערכת".
 *
 * סדר הקבצים בעריכה כמו במחיקה (CLAUDE.md §10): קודם השורה, אחר-כך
 * הקובץ הישן. אם עדכון השורה נכשל — מוחקים את הקובץ **החדש** שהועלה,
 * והישן נשאר במקומו.
 */
export function HallOfFameForm({
  row,
  onDone,
}: {
  row?: HallOfFameRow;
  onDone: () => void;
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const idPrefix = row ? `hof-${row.id}` : "hof-new";

  const [year, setYear] = useState(row ? String(row.year) : "");
  const [teamName, setTeamName] = useState(row?.team_name ?? "");
  const [color, setColor] = useState(row?.team_color ?? "#e23d3d");
  const [members, setMembers] = useState(row?.members.join(", ") ?? "");
  const [file, setFile] = useState<File | null>(null);
  // עריכה: האם להסיר את התמונה הקיימת (בלי להחליף)
  const [removePhoto, setRemovePhoto] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const existingPhoto = removePhoto ? null : (row?.photo_url ?? null);
  // תצוגה מקדימה לקובץ שנבחר — נוצרת פעם אחת לקובץ ומשתחררת בהחלפה
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);
  const shownPhoto = preview ?? existingPhoto;

  async function save() {
    const parsedYear = Number(year);
    if (!Number.isInteger(parsedYear) || parsedYear < 1900 || parsedYear > 2100) {
      return setError("צריך שנה תקינה");
    }
    const name = teamName.trim();
    if (!name) return setError("צריך שם לקבוצה הזוכה");

    setError(null);
    let uploaded: string | null = null;
    try {
      if (file) {
        setBusy("מעלה תמונה...");
        uploaded = await uploadFamilyImage(file, "hall-of-fame");
      }
      const photoUrl = uploaded ?? existingPhoto;

      const fields = {
        year: parsedYear,
        team_name: name,
        team_color: color,
        // ההיסטוריה מגיעה מהזיכרון ולא ממרשם — טקסט חופשי מופרד
        // בפסיקים הוא הפורמט הנכון, לא בורר משתמשים
        members: members
          .split(",")
          .map((m) => m.trim())
          .filter(Boolean),
        photo_url: photoUrl,
      };

      setBusy("שומר...");
      const supabase = createClient();
      const { error: saveError } = row
        ? await supabase.from("hall_of_fame").update(fields).eq("id", row.id)
        : await supabase.from("hall_of_fame").insert(fields);

      if (saveError) {
        await deleteFamilyImage(uploaded);
        // 23505 — `year` הוא unique מ-0001. זו לא תקלה אלא ההגנה:
        // אין שתי שורות לאותה שנה
        throw new Error(
          saveError.code === "23505"
            ? `כבר יש שורה לשנת ${parsedYear}`
            : saveError.message
        );
      }

      // השורה כבר לא מצביעה על הקובץ הישן — עכשיו אפשר למחוק אותו
      if (row?.photo_url && row.photo_url !== photoUrl) {
        await deleteFamilyImage(row.photo_url);
      }

      onDone();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "השמירה נכשלה");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="text-sm font-bold text-muted" htmlFor={`${idPrefix}-year`}>
        שנה
      </label>
      <Input
        id={`${idPrefix}-year`}
        value={year}
        onChange={(e) => setYear(e.target.value)}
        inputMode="numeric"
        placeholder="2009"
        autoFocus={!row}
      />

      <label className="text-sm font-bold text-muted" htmlFor={`${idPrefix}-team`}>
        הקבוצה הזוכה
      </label>
      <Input
        id={`${idPrefix}-team`}
        value={teamName}
        onChange={(e) => setTeamName(e.target.value)}
        maxLength={60}
        placeholder="🐬 הדולפינים"
      />
      <span className="-mt-1 text-xs text-muted">
        אפשר להתחיל באימוג׳י של החיה — הוא חלק מהשם
      </span>

      <div className="flex items-center gap-3">
        <label className="text-sm font-bold text-muted" htmlFor={`${idPrefix}-color`}>
          צבע הקבוצה
        </label>
        <input
          id={`${idPrefix}-color`}
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="h-11 w-20 rounded-card-sm border-2 border-line bg-surface"
        />
      </div>

      <label className="text-sm font-bold text-muted" htmlFor={`${idPrefix}-members`}>
        חברי הקבוצה
      </label>
      <Input
        id={`${idPrefix}-members`}
        value={members}
        onChange={(e) => setMembers(e.target.value)}
        placeholder="דני, שירה, עומר"
      />
      <span className="-mt-1 text-xs text-muted">
        מופרדים בפסיקים. אפשר גם להשאיר ריק אם לא זוכרים
      </span>

      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          setFile(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />
      <div className="flex items-center gap-2">
        {shownPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={shownPhoto}
            alt=""
            className="size-13 flex-none rounded-card-sm border border-line object-cover"
          />
        ) : null}
        <Button
          variant="quiet"
          className="flex-1"
          onClick={() => fileInput.current?.click()}
        >
          {file
            ? `🖼️ ${file.name}`
            : existingPhoto
              ? "🖼️ החלפת התמונה"
              : "🖼️ תמונת הקבוצה (לא חובה)"}
        </Button>
        {shownPhoto ? (
          <button
            type="button"
            aria-label="הסרת התמונה"
            onClick={() => (file ? setFile(null) : setRemovePhoto(true))}
            className="flex min-h-11 min-w-11 flex-none items-center justify-center rounded-full border-2 border-line text-muted active:bg-brand-soft active:text-brand"
          >
            ✕
          </button>
        ) : null}
      </div>

      <div className="flex gap-2">
        <Button className="flex-1" disabled={!!busy} onClick={() => void save()}>
          {busy ?? (row ? "שמירה" : "הוספת השנה")}
        </Button>
        <Button
          variant="secondary"
          className="flex-1"
          disabled={!!busy}
          onClick={onDone}
        >
          ביטול
        </Button>
      </div>
      <FormError>{error}</FormError>
    </div>
  );
}
