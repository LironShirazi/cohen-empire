"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormError } from "@/components/ui/page";
import { PhotoLightbox } from "@/components/gallery/photo-lightbox";
import { createClient } from "@/lib/supabase/client";
import { GALLERY_MAX_BYTES, GALLERY_MAX_MB, prepareImage } from "@/lib/image";
import type { GalleryYear } from "@/lib/data";

export type RaceOption = { id: string; year: number; name: string };

/**
 * הגלריה (docs/04 §26). ההעלאה כותבת ישירות מול RLS ולא דרך RPC —
 * כמו הצ'אט, ומאותה סיבה: אין כאן מה לאמת מעבר לזהות המעלה, והיא
 * נאכפת במדיניות `gallery_insert` (מיגרציה 0012).
 *
 * הניהול (מחיקה ועריכת כותרת) מוצג רק למי שרשאי, אבל ההחלטה האמיתית
 * היא של ה-DB: `can_manage_gallery` במדיניות ה-UPDATE וה-DELETE.
 * מה שכאן הוא נימוס, לא שער.
 */
export function GalleryScreen({
  years,
  races,
  myUserId,
  isOwner,
  adminRaceIds,
}: {
  years: GalleryYear[];
  races: RaceOption[];
  myUserId: string;
  isOwner: boolean;
  adminRaceIds: string[];
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);

  // ברירת המחדל: המירוץ האחרון. אין מירוצים בכלל → השנה הנוכחית,
  // ואז התמונה נשמרת בלי race_id (שנה היסטורית)
  const [target, setTarget] = useState<string>(
    races[0]?.id ?? String(new Date().getFullYear())
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openPhotoId, setOpenPhotoId] = useState<string | null>(null);

  const flat = useMemo(() => years.flatMap((y) => y.photos), [years]);
  const openIndex = flat.findIndex((p) => p.id === openPhotoId);

  const canManage = (raceId: string | null, uploadedBy: string | null) =>
    uploadedBy === myUserId ||
    isOwner ||
    (!!raceId && adminRaceIds.includes(raceId));

  // השנים שאפשר להעלות אליהן: המירוצים שקיימים + השנים שקדמו לאפליקציה
  const historicYears = useMemo(() => {
    const taken = new Set(races.map((r) => r.year));
    const now = new Date().getFullYear();
    const list: number[] = [];
    for (let y = now; y >= now - 25; y--) if (!taken.has(y)) list.push(y);
    return list;
  }, [races]);

  async function uploadFiles(files: File[]) {
    if (files.length === 0) return;
    setError(null);

    const race = races.find((r) => r.id === target);
    const year = race ? race.year : Number(target);
    const supabase = createClient();
    let done = 0;

    for (const file of files) {
      setBusy(`מעלה ${done + 1} מתוך ${files.length}...`);
      try {
        const { blob, extension } = await prepareImage(file);
        if (blob.size > GALLERY_MAX_BYTES) {
          throw new Error(
            `${file.name} גדולה מדי גם אחרי הקטנה (מעל ${GALLERY_MAX_MB}MB)`
          );
        }

        const path = `${year}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from("gallery")
          .upload(path, blob, {
            upsert: false,
            contentType: blob.type || "image/jpeg",
          });
        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from("gallery").getPublicUrl(path);
        const { error: insertError } = await supabase
          .from("gallery_photos")
          .insert({
            race_id: race?.id ?? null,
            year,
            url: data.publicUrl,
            storage_path: path,
            uploaded_by: myUserId,
          });
        // השורה היא מה שנחשב. אם היא נכשלה — הקובץ שכבר עלה מיותר,
        // וזו ההזדמנות היחידה לנקות אותו (למעלה יש הרשאת מחיקה על
        // הקובץ שלו עצמו)
        if (insertError) {
          await supabase.storage.from("gallery").remove([path]);
          throw insertError;
        }
        done++;
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "ההעלאה נכשלה — ננסה שוב?"
        );
        break;
      }
    }

    setBusy(null);
    if (done > 0) router.refresh();
  }

  return (
    <>
      <Card className="mb-6 flex flex-col gap-3">
        <label className="text-sm font-bold text-muted" htmlFor="gallery-year">
          תמונות משנת
        </label>
        <select
          id="gallery-year"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          className="min-h-12 w-full rounded-card-sm border-2 border-line bg-surface px-3 text-[17px]"
        >
          {races.map((race) => (
            <option key={race.id} value={race.id}>
              {race.year} — {race.name}
            </option>
          ))}
          {historicYears.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>

        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            const files = [...(e.target.files ?? [])];
            e.target.value = "";
            void uploadFiles(files);
          }}
        />
        <Button
          size="lg"
          disabled={!!busy}
          onClick={() => fileInput.current?.click()}
        >
          {busy ?? "📷 הוספת תמונות"}
        </Button>
        <p className="text-sm text-muted">
          אפשר לבחור כמה תמונות בבת אחת. הן מוקטנות במכשיר לפני ההעלאה, כדי
          שהגלריה תיפתח מהר גם ברשת סלולרית.
        </p>
        <FormError>{error}</FormError>
      </Card>

      {years.length === 0 ? (
        <Card className="text-center">
          <p className="text-lg font-bold">הגלריה עוד ריקה 📭</p>
          <p className="mt-1 text-muted">
            מי שיש לו תמונות משנים קודמות — זה המקום להעלות אותן.
          </p>
        </Card>
      ) : null}

      <div className="flex flex-col gap-7">
        {years.map((year) => (
          <section key={year.year}>
            <h2 className="mb-2 flex items-baseline gap-2">
              <span className="font-display text-2xl text-brand">
                {year.year}
              </span>
              {year.raceName ? (
                <span className="text-sm text-muted">{year.raceName}</span>
              ) : null}
              <span className="ms-auto text-sm text-muted">
                {year.photos.length === 1
                  ? "תמונה אחת"
                  : `${year.photos.length} תמונות`}
              </span>
            </h2>

            <div className="grid grid-cols-3 gap-1.5">
              {year.photos.map((photo) => (
                <button
                  key={photo.id}
                  onClick={() => setOpenPhotoId(photo.id)}
                  className="relative aspect-square overflow-hidden rounded-card-sm border border-line bg-bg-2"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.url}
                    alt={photo.caption ?? `תמונה משנת ${photo.year}`}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                  {photo.caption ? (
                    <span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-1.5 py-1 text-start text-xs text-white">
                      {photo.caption}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>

      {openIndex >= 0 ? (
        <PhotoLightbox
          key={openPhotoId}
          photos={flat}
          index={openIndex}
          canManage={canManage}
          onNavigate={(i) => setOpenPhotoId(flat[i]?.id ?? null)}
          onClose={() => setOpenPhotoId(null)}
          onChanged={() => {
            setOpenPhotoId(null);
            router.refresh();
          }}
        />
      ) : null}
    </>
  );
}
