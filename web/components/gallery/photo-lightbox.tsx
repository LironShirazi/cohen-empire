"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import type { GalleryPhotoRow } from "@/lib/data";

/**
 * תצוגה מוגדלת של תמונה מהגלריה, עם ניהול למי שרשאי.
 *
 * המסך מקבל `key={photo.id}` מההורה, ולכן מעבר לתמונה אחרת מרכיב אותו
 * מחדש והכותרת שבעריכה מתאפסת מעצמה — בלי אפקט שמסנכרן state ל-props.
 *
 * ⚠️ סדר המחיקה: קודם השורה, אחר-כך הקובץ. השורה היא מה שהמסך קורא,
 * ואם מחיקת הקובץ תיכשל (מנהל תורן שמוחק תמונה שמישהו אחר העלה —
 * מדיניות ה-Storage מרשה רק לבעל הקובץ ולמנהל-על) נשאר קובץ יתום
 * ב-bucket, ולא תמונה שבורה על המסך. זה החוב הידוע גם ב-chat-files.
 */
export function PhotoLightbox({
  photos,
  index,
  canManage,
  onNavigate,
  onClose,
  onChanged,
}: {
  photos: GalleryPhotoRow[];
  index: number;
  canManage: (raceId: string | null, uploadedBy: string | null) => boolean;
  onNavigate: (index: number) => void;
  onClose: () => void;
  onChanged: () => void;
}) {
  const photo = photos[index];
  const [caption, setCaption] = useState(photo?.caption ?? "");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      // RTL: החץ שמאלה מוביל לתמונה הבאה ברשת, שמסודרת מימין לשמאל
      if (e.key === "ArrowLeft" && index < photos.length - 1)
        onNavigate(index + 1);
      if (e.key === "ArrowRight" && index > 0) onNavigate(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, photos.length, onClose, onNavigate]);

  if (!photo) return null;
  const mine = canManage(photo.race_id, photo.uploaded_by);

  async function saveCaption() {
    setBusy(true);
    setError(null);
    const value = caption.trim();
    const { error: updateError } = await createClient()
      .from("gallery_photos")
      .update({ caption: value || null })
      .eq("id", photo.id);
    setBusy(false);
    if (updateError) return setError(updateError.message);
    onChanged();
  }

  async function remove() {
    if (!confirm("למחוק את התמונה מהגלריה? פעולה זו אינה הפיכה.")) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();

    const { error: deleteError } = await supabase
      .from("gallery_photos")
      .delete()
      .eq("id", photo.id);
    if (deleteError) {
      setBusy(false);
      return setError(deleteError.message);
    }
    if (photo.storage_path) {
      await supabase.storage.from("gallery").remove([photo.storage_path]);
    }
    setBusy(false);
    onChanged();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/90 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex items-center gap-3 text-white">
        <button
          onClick={onClose}
          aria-label="סגירה"
          className="min-h-11 min-w-11 rounded-full bg-white/15 text-xl"
        >
          ✕
        </button>
        <span className="text-sm opacity-80">
          {photo.year}
          {photo.uploader_name ? ` · העלה/תה ${photo.uploader_name}` : ""}
        </span>
        <span className="ms-auto text-sm opacity-80">
          {index + 1}/{photos.length}
        </span>
      </div>

      <div className="flex min-h-0 flex-1 items-center gap-2 py-3">
        {/* RTL: הראשון בשורה יושב מימין, ולכן הוא זה שחוזר אחורה —
            והחץ מצביע לכיוון שאליו הוא באמת מזיז */}
        <button
          onClick={() => onNavigate(index + 1)}
          disabled={index >= photos.length - 1}
          aria-label="הבאה"
          className="min-h-12 min-w-10 rounded-card-sm bg-white/15 text-2xl text-white disabled:opacity-25"
        >
          ‹
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.url}
          alt={photo.caption ?? `תמונה משנת ${photo.year}`}
          className="mx-auto max-h-full min-h-0 flex-1 object-contain"
        />
        <button
          onClick={() => onNavigate(index - 1)}
          disabled={index <= 0}
          aria-label="הקודמת"
          className="min-h-12 min-w-10 rounded-card-sm bg-white/15 text-2xl text-white disabled:opacity-25"
        >
          ›
        </button>
      </div>

      <div className="flex flex-col gap-2 text-white">
        {editing ? (
          <>
            <input
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              maxLength={140}
              placeholder="מה קורה בתמונה?"
              className="min-h-12 w-full rounded-card-sm border-2 border-white/30 bg-white/10 px-3 text-[17px] text-white placeholder:text-white/50"
            />
            <div className="flex gap-2">
              <Button
                className="flex-1"
                disabled={busy}
                onClick={() => void saveCaption()}
              >
                שמירה
              </Button>
              <Button
                variant="quiet"
                className="flex-1 text-white"
                disabled={busy}
                onClick={() => {
                  setCaption(photo.caption ?? "");
                  setEditing(false);
                }}
              >
                ביטול
              </Button>
            </div>
          </>
        ) : (
          <>
            {photo.caption ? (
              <p className="text-center text-lg">{photo.caption}</p>
            ) : null}
            {mine ? (
              <div className="flex gap-2">
                <Button
                  variant="accent"
                  className="flex-1"
                  disabled={busy}
                  onClick={() => setEditing(true)}
                >
                  ✏️ {photo.caption ? "עריכת הכותרת" : "הוספת כותרת"}
                </Button>
                <Button
                  variant="quiet"
                  className="flex-1 text-white"
                  disabled={busy}
                  onClick={() => void remove()}
                >
                  🗑️ מחיקה
                </Button>
              </div>
            ) : null}
          </>
        )}
        {error ? (
          <p className="rounded-card-sm bg-danger px-3 py-2 text-center text-sm font-bold">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
