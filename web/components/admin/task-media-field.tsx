"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/page";
import { isVideoUrl } from "@/lib/media";
import { createClient } from "@/lib/supabase/client";

const MAX_MEDIA_MB = 50;
const MAX_MEDIA_BYTES = MAX_MEDIA_MB * 1024 * 1024;

/**
 * תמונה או סרטון שנפתחים יחד עם המשימה (docs/01 §4, docs/04 §3).
 * הקובץ עולה ל-bucket `station-media` מיד בבחירה, וה-URL נשמר בשדה
 * מוסתר — כך ה-server action מקבל מחרוזת ולא קובץ.
 */
export function TaskMediaField({
  raceId,
  defaultUrl,
}: {
  raceId: string;
  defaultUrl?: string | null;
}) {
  const [url, setUrl] = useState<string | null>(defaultUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setError(null);

    // ברירת המחדל של Supabase Storage היא 50MB לקובץ, וסרטון מהטלפון
    // עובר את זה בקלות. עדיף לעצור כאן עם הודעה בעברית מאשר לחכות
    // להעלאה ארוכה שנופלת עם שגיאה באנגלית באמצע
    if (file.size > MAX_MEDIA_BYTES) {
      setError(
        `הקובץ גדול מדי (${Math.round(file.size / 1024 / 1024)}MB). ` +
          `המקסימום הוא ${MAX_MEDIA_MB}MB — אפשר לקצר את הסרטון או לצלם באיכות נמוכה יותר.`
      );
      return;
    }

    setUploading(true);
    try {
      const supabase = createClient();
      const extension = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      // התיקייה היא מזהה המירוץ — מדיניות ה-Storage מוודאת שרק מנהל
      // של אותו מירוץ יכול להעלות לתוכה
      const path = `${raceId}/${crypto.randomUUID()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("station-media")
        .upload(path, file, { upsert: false });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from("station-media")
        .getPublicUrl(path);
      setUrl(data.publicUrl);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "ההעלאה נכשלה — ננסה שוב?"
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="block">
      <span className="mb-1.5 block text-[15px] font-bold">
        תמונה או סרטון למשימה (רשות)
      </span>

      <input type="hidden" name="task_media" value={url ?? ""} />
      <input
        ref={fileInput}
        type="file"
        accept="image/*,video/*"
        hidden
        onChange={async (event) => {
          const file = event.target.files?.[0];
          if (file) await upload(file);
          event.target.value = "";
        }}
      />

      {url ? (
        <div className="mb-2 overflow-hidden rounded-card-sm border-2 border-line bg-bg-2">
          {isVideoUrl(url) ? (
            <video src={url} controls className="max-h-48 w-full object-contain" />
          ) : (
            // next/image לא מכיר את דומיין ה-Storage; זו תצוגה מקדימה
            // קטנה בממשק הניהול בלבד
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt="תצוגה מקדימה של מדיית המשימה"
              className="max-h-48 w-full object-contain"
            />
          )}
        </div>
      ) : null}

      <div className="flex gap-2">
        <Button
          type="button"
          variant="secondary"
          disabled={uploading}
          onClick={() => fileInput.current?.click()}
        >
          {uploading ? "מעלים…" : url ? "החלפת המדיה" : "בחירת תמונה או סרטון"}
        </Button>

        {url ? (
          <Button
            type="button"
            variant="quiet"
            disabled={uploading}
            onClick={() => setUrl(null)}
          >
            הסרה
          </Button>
        ) : null}
      </div>

      <span className="mt-1 block text-sm text-muted">
        נפתח יחד עם המשימה, רק אחרי שהשרת מאמת הגעה · עד {MAX_MEDIA_MB}MB
      </span>

      <FormError>{error}</FormError>
    </div>
  );
}
