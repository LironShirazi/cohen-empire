"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { FormError } from "@/components/ui/page";
import { createClient } from "@/lib/supabase/client";
import { deleteFamilyImage, uploadFamilyImage } from "@/lib/family-content";

/**
 * הזנת היכל התהילה ההיסטורי (docs/04 §5) — למנהל-על בלבד.
 *
 * מרונדר בתחתית `/hall-of-fame` עצמו ולא ב-`/admin/content`: מי שמזין
 * שנה רואה מיד איך היא נראית בהיכל. השער שם (`profile.is_owner`) הוא
 * נוחות — האכיפה היא ב-RLS (`is_owner()`, 0014).
 *
 * כאן רק ההוספה. המחיקה יושבת על השורות של הרשימה עצמה
 * (`HallOfFameDelete`), כדי שלא תהיה רשימה כפולה במסך.
 *
 * הטבלה נכתבת משני מקורות: `finish_race` (0002) מוסיף שורה בסיום כל
 * מירוץ באפליקציה, וכאן מוזנות ידנית 20 השנים שקדמו לה.
 *
 * ⚠️ **`race_id` לא נשלח מכאן ואי אפשר לשנות אותו** — הוא מחוץ ל-
 * `grant update` ב-0014. הוא מה שמבדיל שורה של המערכת משורה מהזיכרון.
 */
export function HallOfFameEditor() {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [year, setYear] = useState("");
  const [teamName, setTeamName] = useState("");
  const [color, setColor] = useState("#e23d3d");
  const [members, setMembers] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setOpen(false);
    setYear("");
    setTeamName("");
    setColor("#e23d3d");
    setMembers("");
    setFile(null);
    setError(null);
  }

  async function create() {
    const parsedYear = Number(year);
    if (!Number.isInteger(parsedYear) || parsedYear < 1900 || parsedYear > 2100) {
      return setError("צריך שנה תקינה");
    }
    const name = teamName.trim();
    if (!name) return setError("צריך שם לקבוצה הזוכה");

    setError(null);
    try {
      let photoUrl: string | null = null;
      if (file) {
        setBusy("מעלה תמונה...");
        photoUrl = await uploadFamilyImage(file, "hall-of-fame");
      }

      setBusy("שומר...");
      const { error: insertError } = await createClient()
        .from("hall_of_fame")
        .insert({
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
        });

      if (insertError) {
        await deleteFamilyImage(photoUrl);
        // 23505 — `year` הוא unique מ-0001. זו לא תקלה אלא ההגנה:
        // אין שתי שורות לאותה שנה
        throw new Error(
          insertError.code === "23505"
            ? `כבר יש שורה לשנת ${parsedYear} — אפשר למחוק אותה ולהזין מחדש`
            : insertError.message
        );
      }

      reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "השמירה נכשלה");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-display text-h2">✏️ ניהול היכל התהילה</h2>
      <p className="-mt-2 text-sm text-muted">
        גלוי למנהלי-על בלבד. מירוץ שמסתיים באפליקציה נכנס לבד — כאן מזינים
        את השנים שקדמו לה. מחיקה — בכפתור 🗑️ על השורה עצמה.
      </p>

      {open ? (
        <Card className="flex flex-col gap-3">
          <label className="text-sm font-bold text-muted" htmlFor="hof-year">
            שנה
          </label>
          <Input
            id="hof-year"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            inputMode="numeric"
            placeholder="2009"
            autoFocus
          />

          <label className="text-sm font-bold text-muted" htmlFor="hof-team">
            הקבוצה הזוכה
          </label>
          <Input
            id="hof-team"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            maxLength={60}
            placeholder="🐬 הדולפינים"
          />
          <span className="-mt-1 text-xs text-muted">
            אפשר להתחיל באימוג׳י של החיה — הוא חלק מהשם
          </span>

          <div className="flex items-center gap-3">
            <label className="text-sm font-bold text-muted" htmlFor="hof-color">
              צבע הקבוצה
            </label>
            <input
              id="hof-color"
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-11 w-20 rounded-card-sm border-2 border-line bg-surface"
            />
          </div>

          <label className="text-sm font-bold text-muted" htmlFor="hof-members">
            חברי הקבוצה
          </label>
          <Input
            id="hof-members"
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
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <Button variant="quiet" onClick={() => fileInput.current?.click()}>
            {file ? `🖼️ ${file.name}` : "🖼️ תמונת הקבוצה (לא חובה)"}
          </Button>

          <div className="flex gap-2">
            <Button
              className="flex-1"
              disabled={!!busy}
              onClick={() => void create()}
            >
              {busy ?? "הוספת השנה"}
            </Button>
            <Button
              variant="secondary"
              className="flex-1"
              disabled={!!busy}
              onClick={reset}
            >
              ביטול
            </Button>
          </div>
          <FormError>{error}</FormError>
        </Card>
      ) : (
        <>
          <Button className="w-full" onClick={() => setOpen(true)}>
            ➕ שנה מההיסטוריה
          </Button>
          <FormError>{error}</FormError>
        </>
      )}
    </section>
  );
}
