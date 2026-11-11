"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/ui/confirm";
import { HallOfFameForm } from "@/components/family/hall-of-fame-form";
import { deleteFamilyImage } from "@/lib/family-content";
import { createClient } from "@/lib/supabase/client";
import type { HallOfFameRow } from "@/lib/supabase/types";

/**
 * ✏️ על שורה בהיכל התהילה — עריכה ומחיקה, למנהל-על בלבד.
 *
 * הרשימה (`HallOfFameList`) נשארת רכיב שרת ומרנדרת את זה רק כש-
 * `canEdit`, כך שהמסך של מנהל-על זהה למה שכל המשפחה רואה פרט לכפתור
 * אחד בגודל התמונה — גובה השורה לא משתנה. העריכה והמחיקה נפתחות בחלון
 * ולא בתוך השורה, מאותה סיבה. השער הוא נוחות: האכיפה היא RLS (`is_owner()`, 0014).
 *
 * סדר המחיקה כמו בגלריה (CLAUDE.md §10): קודם השורה, אחר-כך הקובץ.
 */
export function HallOfFameRowActions({
  row,
  tone = "light",
}: {
  row: HallOfFameRow;
  /** `dark` לכרטיס האלופים הקוסמי */
  tone?: "light" | "dark";
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!editing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setEditing(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editing]);

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
    <>
      <button
        type="button"
        aria-label={`עריכת שנת ${row.year}`}
        onClick={() => setEditing(true)}
        className={`flex size-10 flex-none items-center justify-center rounded-full border-2 ${colors}`}
      >
        ✏️
      </button>

      {editing ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`עריכת שנת ${row.year}`}
          className="fixed inset-0 z-[110] flex items-end justify-center bg-navy/55 p-4 backdrop-blur-[2px] sm:items-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditing(false);
          }}
        >
          <div className="max-h-full w-full max-w-sm overflow-y-auto rounded-card-lg bg-surface p-5 text-ink shadow-card-lg">
            <h2 className="mb-3 font-display text-h2">עריכת שנת {row.year}</h2>
            <HallOfFameForm row={row} onDone={() => setEditing(false)} />

            {/* המחיקה בתוך חלון העריכה ולא על השורה: כפתור שני בשורה
                חתך את שם הקבוצה ושבר את "אלופי 2025" לשתי שורות, והמסך
                של מנהל-על אמור להיראות כמו של כל המשפחה */}
            <div className="mt-4 border-t-2 border-line pt-4">
              <button
                type="button"
                onClick={() => void remove()}
                disabled={busy}
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-full font-bold text-danger active:bg-brand-soft disabled:opacity-50"
              >
                {busy ? "מוחק..." : `🗑️ מחיקת שנת ${row.year} מההיכל`}
              </button>
              {error ? (
                <p role="alert" className="mt-1 text-center text-xs font-bold text-danger">
                  {error}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
