"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/ui/confirm";
import { deleteFamilyImage } from "@/lib/family-content";
import { createClient } from "@/lib/supabase/client";
import type { HallOfFameRow } from "@/lib/supabase/types";

/**
 * מחיקת שנה מהיכל התהילה — יושבת על השורה עצמה, למנהל-על בלבד.
 *
 * הרשימה (`HallOfFameList`) נשארת רכיב שרת ומרנדרת את הכפתור הזה רק
 * כש-`canEdit`. השער הוא נוחות: האכיפה היא מדיניות ה-DELETE ב-RLS
 * (`is_owner()`, 0014).
 *
 * סדר המחיקה כמו בגלריה (CLAUDE.md §10): קודם השורה, אחר-כך הקובץ.
 */
export function HallOfFameDelete({
  row,
  tone = "light",
}: {
  row: HallOfFameRow;
  /** `dark` לכרטיס האלופים הקוסמי */
  tone?: "light" | "dark";
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    const ok = await confirm({
      title: "מחיקה מהיכל התהילה",
      // שורה שנוצרה ע"י המערכת היא תיעוד של מירוץ אמיתי — כדאי לדעת
      message: row.race_id
        ? `שנת ${row.year} נרשמה מתוך מירוץ באפליקציה. למחוק אותה מהיכל התהילה?`
        : `למחוק את שנת ${row.year} מהיכל התהילה?`,
    });
    if (!ok) return;

    setBusy(true);
    setError(null);
    const { error: deleteError } = await createClient()
      .from("hall_of_fame")
      .delete()
      .eq("id", row.id);

    if (deleteError) {
      setBusy(false);
      return setError("המחיקה נכשלה");
    }

    await deleteFamilyImage(row.photo_url);
    router.refresh();
  }

  const colors =
    tone === "dark"
      ? "border-white/25 text-on-navy-muted active:bg-white/10"
      : "border-line text-muted active:bg-brand-soft active:text-brand";

  return (
    <span className="flex flex-none flex-col items-center gap-0.5">
      <button
        type="button"
        aria-label={`מחיקת שנת ${row.year}`}
        onClick={() => void remove()}
        disabled={busy}
        className={`flex min-h-11 min-w-11 items-center justify-center rounded-full border-2 disabled:opacity-50 ${colors}`}
      >
        {busy ? "…" : "🗑️"}
      </button>
      {error ? (
        <span role="alert" className="text-xs font-bold text-danger">
          {error}
        </span>
      ) : null}
    </span>
  );
}
