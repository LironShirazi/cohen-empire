"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormError } from "@/components/ui/page";
import { PhotoLightbox } from "@/components/gallery/photo-lightbox";
import { createClient } from "@/lib/supabase/client";
import { isVideoUrl } from "@/lib/media";
import { GALLERY_MAX_BYTES, GALLERY_MAX_MB, prepareImage } from "@/lib/image";
import type { GalleryAlbum } from "@/lib/supabase/types";
import type { GalleryPhotoRow } from "@/lib/data";

/**
 * אלבום בגלריה: שם שאפשר לתקן, מדיה שכל בן משפחה מוסיף, ותצוגה מוגדלת.
 *
 * ההעלאה כותבת ישירות מול RLS ולא דרך RPC — כמו הצ'אט, ומאותה סיבה:
 * אין מה לאמת מעבר לזהות המעלה, והיא נאכפת ב-`gallery_insert` (0012).
 *
 * ⚠️ שם האלבום פתוח לעריכה **לכל בן משפחה** ולא רק לפותח אותו — האלבום
 * שייך למשפחה, כמו עלה בעץ (docs/06 §4). מה ששמור לפותח ולמנהל-על הוא
 * המחיקה, והיא ממילא נכשלת כל עוד יש באלבום מדיה.
 */
export function AlbumScreen({
  album,
  photos,
  myUserId,
  isOwner,
}: {
  album: GalleryAlbum;
  photos: GalleryPhotoRow[];
  myUserId: string;
  isOwner: boolean;
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(album.name);
  const [renaming, setRenaming] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openPhotoId, setOpenPhotoId] = useState<string | null>(null);

  const openIndex = photos.findIndex((p) => p.id === openPhotoId);
  const canDeleteAlbum = album.created_by === myUserId || isOwner;

  async function saveName() {
    const value = name.trim();
    if (!value) return setError("צריך שם לאלבום");

    setBusy("שומר...");
    setError(null);
    const { error: updateError } = await createClient()
      .from("gallery_albums")
      .update({ name: value })
      .eq("id", album.id);
    setBusy(null);

    if (updateError) return setError(updateError.message);
    setRenaming(false);
    router.refresh();
  }

  async function deleteAlbum() {
    if (!confirm(`למחוק את האלבום "${album.name}"?`)) return;
    setBusy("מוחק...");
    setError(null);
    const { error: deleteError } = await createClient()
      .from("gallery_albums")
      .delete()
      .eq("id", album.id);
    setBusy(null);

    // 23503 — יש עוד מדיה באלבום (`on delete restrict`). זו לא תקלה
    // אלא ההגנה: אלבום לא נמחק עם התמונות של כולם בתוכו
    if (deleteError) {
      return setError(
        deleteError.code === "23503"
          ? "אי אפשר למחוק אלבום שיש בו מדיה — צריך למחוק אותה קודם"
          : deleteError.message
      );
    }
    router.push("/gallery");
  }

  async function uploadFiles(files: File[]) {
    if (files.length === 0) return;
    setError(null);
    const supabase = createClient();
    let done = 0;

    for (const file of files) {
      setBusy(`מעלה ${done + 1} מתוך ${files.length}...`);
      try {
        // סרטון עובר כמו שהוא — ההקטנה היא לתמונות בלבד
        const { blob, extension } = file.type.startsWith("video/")
          ? { blob: file as Blob, extension: file.name.split(".").pop() || "mp4" }
          : await prepareImage(file);

        if (blob.size > GALLERY_MAX_BYTES) {
          throw new Error(
            `${file.name} גדול מדי (מעל ${GALLERY_MAX_MB}MB)`
          );
        }

        const path = `${album.id}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from("gallery")
          .upload(path, blob, {
            upsert: false,
            contentType: blob.type || "application/octet-stream",
          });
        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from("gallery").getPublicUrl(path);
        const { error: insertError } = await supabase
          .from("gallery_photos")
          .insert({
            album_id: album.id,
            url: data.publicUrl,
            storage_path: path,
            uploaded_by: myUserId,
          });
        // השורה היא מה שנחשב. אם היא נכשלה — הקובץ שכבר עלה מיותר, וזו
        // ההזדמנות היחידה לנקות אותו (למעלה יש הרשאת מחיקה על הקובץ שלו)
        if (insertError) {
          await supabase.storage.from("gallery").remove([path]);
          throw insertError;
        }
        done++;
      } catch (err) {
        setError(err instanceof Error ? err.message : "ההעלאה נכשלה — ננסה שוב?");
        break;
      }
    }

    setBusy(null);
    if (done > 0) router.refresh();
  }

  return (
    <>
      {renaming ? (
        <Card className="mb-5 flex flex-col gap-3">
          <label className="text-sm font-bold text-muted" htmlFor="album-rename">
            שם האלבום
          </label>
          <input
            id="album-rename"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void saveName();
            }}
            maxLength={60}
            autoFocus
            className="min-h-12 w-full rounded-card-sm border-2 border-line bg-surface px-3 text-[17px]"
          />
          <div className="flex gap-2">
            <Button
              className="flex-1"
              disabled={!!busy}
              onClick={() => void saveName()}
            >
              שמירה
            </Button>
            <Button
              variant="secondary"
              className="flex-1"
              disabled={!!busy}
              onClick={() => {
                setName(album.name);
                setRenaming(false);
                setError(null);
              }}
            >
              ביטול
            </Button>
          </div>
        </Card>
      ) : (
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <h1 className="font-display text-2xl">{album.name}</h1>
          <button
            onClick={() => setRenaming(true)}
            className="min-h-11 rounded-card-sm px-2 text-sm font-bold text-muted"
          >
            ✏️ שינוי השם
          </button>
          {canDeleteAlbum ? (
            <button
              onClick={() => void deleteAlbum()}
              disabled={!!busy}
              className="ms-auto min-h-11 rounded-card-sm px-2 text-sm font-bold text-muted"
            >
              🗑️ מחיקת האלבום
            </button>
          ) : null}
        </div>
      )}

      <input
        ref={fileInput}
        type="file"
        accept="image/*,video/*"
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
        className="w-full"
        disabled={!!busy}
        onClick={() => fileInput.current?.click()}
      >
        {busy ?? "📷 הוספת תמונות וסרטונים"}
      </Button>
      <p className="mt-2 text-sm text-muted">
        אפשר לבחור כמה קבצים בבת אחת. תמונות מוקטנות במכשיר לפני ההעלאה, כדי
        שהאלבום ייפתח מהר גם ברשת סלולרית.
      </p>
      <div className="mt-2">
        <FormError>{error}</FormError>
      </div>

      {photos.length === 0 ? (
        <Card className="mt-6 text-center">
          <p className="text-lg font-bold">האלבום עוד ריק 📭</p>
          <p className="mt-1 text-muted">
            כל בן משפחה יכול להוסיף לכאן תמונות וסרטונים.
          </p>
        </Card>
      ) : (
        <div className="mt-6 grid grid-cols-3 gap-1.5">
          {photos.map((photo) => (
            <button
              key={photo.id}
              onClick={() => setOpenPhotoId(photo.id)}
              className="relative aspect-square overflow-hidden rounded-card-sm border border-line bg-bg-2"
            >
              {isVideoUrl(photo.url) ? (
                <>
                  {/* preload=metadata — הפריים הראשון בלבד, בלי להוריד
                      את הסרטון כולו רק בשביל התצוגה המקדימה */}
                  <video
                    src={photo.url}
                    preload="metadata"
                    muted
                    playsInline
                    className="h-full w-full object-cover"
                  />
                  <span className="absolute inset-0 flex items-center justify-center text-3xl text-white drop-shadow">
                    ▶
                  </span>
                </>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photo.url}
                  alt={photo.caption ?? "תמונה מהאלבום"}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              )}
              {photo.caption ? (
                <span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-1.5 py-1 text-start text-xs text-white">
                  {photo.caption}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      )}

      {openIndex >= 0 ? (
        <PhotoLightbox
          key={openPhotoId}
          photos={photos}
          index={openIndex}
          myUserId={myUserId}
          isOwner={isOwner}
          onNavigate={(i) => setOpenPhotoId(photos[i]?.id ?? null)}
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
