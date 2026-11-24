"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { FormError } from "@/components/ui/page";
import { PhotoLightbox } from "@/components/gallery/photo-lightbox";
import { createClient } from "@/lib/supabase/client";
import {
  isVideoFile,
  isVideoUrl,
  STORAGE_MAX_BYTES,
  STORAGE_MAX_MB,
} from "@/lib/media";
import {
  GALLERY_IMAGE_MAX_BYTES,
  GALLERY_IMAGE_MAX_MB,
  prepareImage,
} from "@/lib/image";
import type { GalleryAlbum } from "@/lib/supabase/types";
import type { GalleryPhotoRow } from "@/lib/data";
import { useConfirm } from "@/components/ui/confirm";

import { startNavProgress } from "@/components/ui/navigation-progress";
import { Icon } from "@/components/ui/icon";
import { canDeletePhoto, deletePhotos } from "@/lib/gallery-actions";
import { useMediaActions } from "@/components/gallery/use-media-actions";
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
  const confirm = useConfirm();
  const fileInput = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(album.name);
  const [renaming, setRenaming] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openPhotoId, setOpenPhotoId] = useState<string | null>(null);

  // מצב בחירה: הקשה על פריט מסמנת אותו במקום לפתוח את התצוגה המוגדלת
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const media = useMediaActions(album.name, photos);

  const openIndex = photos.findIndex((p) => p.id === openPhotoId);
  // לפי סדר האלבום ולא לפי סדר ההקשה — כך גם שמות הקבצים בהורדה
  const selected = photos.filter((p) => selectedIds.has(p.id));
  const deletable = selected.filter((p) =>
    canDeletePhoto(p, myUserId, isOwner)
  );

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function stopSelecting() {
    setSelecting(false);
    setSelectedIds(new Set());
    media.setError(null);
  }

  /**
   * מחיקה מרובה — רק של מה שמותר (מי שהעלה, או מנהל-על). מה שנבחר
   * ושייך לאחרים נשאר, וההודעה אומרת את זה מראש ולא בדיעבד.
   * ה-RLS (`gallery_delete`, 0013) הוא הקובע; הסינון כאן הוא נימוס.
   */
  async function deleteSelected() {
    if (deletable.length === 0) return;
    const others = selected.length - deletable.length;
    const ok = await confirm({
      title: "מחיקה מהגלריה",
      message:
        (deletable.length === 1
          ? "למחוק פריט אחד מהאלבום?"
          : `למחוק ${deletable.length} פריטים מהאלבום?`) +
        (others > 0
          ? ` ${others === 1 ? "פריט אחד שהעלו אחרים יישאר" : `${others} פריטים שהעלו אחרים יישארו`} — רק מי שהעלה יכול למחוק.`
          : "") +
        " פעולה זו אינה הפיכה.",
    });
    if (!ok) return;

    setBusy("מוחק...");
    setError(null);
    try {
      await deletePhotos(deletable);
      stopSelecting();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "המחיקה נכשלה — ננסה שוב?");
    } finally {
      setBusy(null);
    }
  }
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
    const ok = await confirm({
      title: "מחיקת אלבום",
      message: `למחוק את האלבום "${album.name}"?`,
    });
    if (!ok) return;
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
    startNavProgress("/gallery");
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
        // סרטון עובר כמו שהוא — ההקטנה היא לתמונות בלבד. לכן גם התקרה
        // שלו אחרת: מה שה-bucket מרשה, ולא התקרה של תמונה אחרי הקטנה
        const isVideo = isVideoFile(file);
        const { blob, extension } = isVideo
          ? {
              blob: file as Blob,
              extension: file.name.split(".").pop()?.toLowerCase() || "mp4",
            }
          : await prepareImage(file);

        const maxBytes = isVideo ? STORAGE_MAX_BYTES : GALLERY_IMAGE_MAX_BYTES;
        const maxMb = isVideo ? STORAGE_MAX_MB : GALLERY_IMAGE_MAX_MB;
        if (blob.size > maxBytes) {
          throw new Error(`${file.name} גדול מדי (מעל ${maxMb}MB)`);
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
          <Input
            id="album-rename"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void saveName();
            }}
            maxLength={60}
            autoFocus
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
          <h1 className="font-display text-h1">{album.name}</h1>
          <button
            onClick={() => setRenaming(true)}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-card-sm px-2 text-sm font-bold text-muted"
          >
            <Icon name="edit" size={18} />
            שינוי השם
          </button>
          {canDeleteAlbum ? (
            <button
              onClick={() => void deleteAlbum()}
              disabled={!!busy}
              className="ms-auto inline-flex min-h-11 items-center gap-1.5 rounded-card-sm px-2 text-sm font-bold text-muted"
            >
              <Icon name="trash" size={18} />
              מחיקת האלבום
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
        {busy ?? (
          <>
            <Icon name="camera" size={24} />
            הוספת תמונות וסרטונים
          </>
        )}
      </Button>
      <p className="mt-2 text-sm text-muted">
        אפשר לבחור כמה קבצים בבת אחת. תמונות מוקטנות במכשיר לפני ההעלאה, כדי
        שהאלבום ייפתח מהר גם ברשת סלולרית. סרטון עולה כמו שהוא, עד{" "}
        {STORAGE_MAX_MB}MB.
      </p>
      <div className="mt-2">
        <FormError>{error}</FormError>
      </div>

      {photos.length === 0 ? (
        <Card className="mt-6 text-center">
          <p className="text-lg font-bold">האלבום עוד ריק</p>
          <p className="mt-1 text-muted">
            כל בן משפחה יכול להוסיף לכאן תמונות וסרטונים.
          </p>
        </Card>
      ) : (
        <>
        <div className="mt-6 flex min-h-11 items-center gap-2">
          {selecting ? (
            <>
              <span className="font-bold">
                {selected.length === 0
                  ? "הקישו על פריטים לבחירה"
                  : `נבחרו ${selected.length}`}
              </span>
              <button
                onClick={() =>
                  setSelectedIds(
                    selected.length === photos.length
                      ? new Set()
                      : new Set(photos.map((p) => p.id))
                  )
                }
                className="inline-flex min-h-11 items-center rounded-card-sm px-2 text-sm font-bold text-brand"
              >
                {selected.length === photos.length ? "ניקוי" : "בחירת הכל"}
              </button>
              <button
                onClick={stopSelecting}
                className="ms-auto inline-flex min-h-11 items-center gap-1.5 rounded-card-sm px-2 text-sm font-bold text-muted"
              >
                <Icon name="close" size={18} />
                סיום
              </button>
            </>
          ) : (
            <>
              <span className="text-sm text-muted">
                {photos.length === 1 ? "פריט אחד" : `${photos.length} פריטים`}
              </span>
              <button
                onClick={() => setSelecting(true)}
                className="ms-auto inline-flex min-h-11 items-center gap-1.5 rounded-card-sm px-2 text-sm font-bold text-muted"
              >
                <Icon name="check" size={18} />
                בחירה
              </button>
            </>
          )}
        </div>
        {/* רשת masonry (סקיצה 2e): הפריט הראשון תופס 2×2 והרביעי
            נמתח לרוחב, כדי שהאלבום ייראה כמו קיר תמונות ולא כמו
            גיליון. `grid-auto-rows: 1fr` שומר על השורות שוות גובה.
            בזמן בחירה יש ריפוד תחתון — הסרגל הצף לא מסתיר את השורה האחרונה */}
        <div
          className={`mt-3 grid auto-rows-[1fr] grid-cols-3 gap-1.5 ${
            selecting ? "pb-28" : ""
          }`}
        >
          {photos.map((photo, index) => {
            const isSelected = selectedIds.has(photo.id);
            return (
            <button
              key={photo.id}
              onClick={() =>
                selecting ? toggle(photo.id) : setOpenPhotoId(photo.id)
              }
              aria-pressed={selecting ? isSelected : undefined}
              className={`relative overflow-hidden rounded-card-sm border bg-bg-2 ${
                isSelected
                  ? "border-brand ring-[3px] ring-brand"
                  : "border-line"
              } ${
                index === 0
                  ? "col-span-2 row-span-2 aspect-square"
                  : index === 3
                    ? "col-span-2 aspect-[2/1]"
                    : "aspect-square"
              }`}
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
                  <span className="absolute inset-0 flex items-center justify-center text-white drop-shadow">
                    <span className="flex size-11 items-center justify-center rounded-full bg-black/45">
                      <Icon name="play" size={22} label="סרטון" />
                    </span>
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
              {selecting ? (
                <span
                  className={`absolute start-1.5 top-1.5 flex size-7 items-center justify-center rounded-full border-2 border-white shadow ${
                    isSelected ? "bg-brand text-white" : "bg-black/30"
                  }`}
                >
                  {isSelected ? <Icon name="check" size={16} /> : null}
                </span>
              ) : null}
            </button>
            );
          })}
        </div>
        </>
      )}

      {selecting ? (
        // סרגל הפעולות הצף. כפתור המחיקה מופיע רק כשיש בבחירה משהו
        // שמותר לי למחוק, והמספר שעליו הוא מה שבאמת יימחק
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] shadow-[0_-6px_20px_rgba(0,0,0,0.08)] backdrop-blur">
          <div className="mx-auto flex max-w-md flex-col gap-2 md:max-w-2xl">
            {media.error || media.notice ? (
              <p
                className={`text-center text-sm font-bold ${
                  media.error ? "text-danger" : "text-muted"
                }`}
              >
                {media.error ?? media.notice}
              </p>
            ) : null}
            <div className="flex gap-2">
              <Button
                variant="secondary"
                className="flex-1 px-2"
                disabled={selected.length === 0 || !!media.busy || !!busy}
                onClick={() => void media.download(selected)}
              >
                <Icon name="download" />
                {media.busy ?? "הורדה"}
              </Button>
              {media.pendingShare ? (
                <Button
                  variant="accent"
                  className="flex-1 px-2"
                  onClick={() => void media.sharePending()}
                >
                  <Icon name="share" />
                  מוכן — לשיתוף
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  className="flex-1 px-2"
                  disabled={selected.length === 0 || !!media.busy || !!busy}
                  onClick={() => void media.share(selected)}
                >
                  <Icon name="share" />
                  שיתוף
                </Button>
              )}
              {deletable.length > 0 ? (
                <Button
                  className="flex-1 px-2"
                  disabled={!!media.busy || !!busy}
                  onClick={() => void deleteSelected()}
                >
                  <Icon name="trash" />
                  מחיקה{deletable.length > 1 ? ` (${deletable.length})` : ""}
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {openIndex >= 0 ? (
        <PhotoLightbox
          key={openPhotoId}
          albumName={album.name}
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
