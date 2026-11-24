"use client";

import { createClient } from "@/lib/supabase/client";
import type { GalleryPhotoRow } from "@/lib/data";

/**
 * הורדה, שיתוף ומחיקה של מדיה מהגלריה — לפריט בודד (התצוגה המוגדלת)
 * ולבחירה מרובה (מצב "בחירה" באלבום). לוגיקת לקוח בלבד.
 *
 * ⚠️ `<a download>` לא עובד על URL ממקור אחר — הדפדפן מתעלם מהשם ופותח
 * את התמונה בלשונית. לכן מושכים את הקובץ ל-Blob ומורידים URL מקומי.
 * זה עובד רק כי ה-bucket ציבורי עם CORS פתוח (כמו בייצוא העץ, §4).
 */

/** האם מותר למחוק — אותה הכרעה כמו `gallery_delete` (0013) */
export function canDeletePhoto(
  photo: GalleryPhotoRow,
  myUserId: string,
  isOwner: boolean
): boolean {
  return photo.uploaded_by === myUserId || isOwner;
}

function extensionOf(photo: GalleryPhotoRow): string {
  const path = (photo.storage_path ?? photo.url).split("?")[0] ?? "";
  return path.split(".").pop()?.toLowerCase() || "jpg";
}

/** שם קובץ קריא: שם האלבום + מספר רץ, ולא ה-uuid מה-bucket */
function fileNameFor(photo: GalleryPhotoRow, albumName: string, n: number) {
  const base = albumName.replace(/[\\/:*?"<>|]+/g, " ").trim() || "גלריה";
  return `${base} ${n}.${extensionOf(photo)}`;
}

/** מושך את המדיה כקבצים, לפי הסדר באלבום */
export async function fetchPhotoFiles(
  photos: GalleryPhotoRow[],
  albumName: string,
  allPhotos: GalleryPhotoRow[],
  onProgress?: (done: number) => void
): Promise<File[]> {
  const files: File[] = [];
  for (const photo of photos) {
    const res = await fetch(photo.url);
    if (!res.ok) throw new Error("לא הצלחנו להביא את הקובץ — ננסה שוב?");
    const blob = await res.blob();
    // המספר הוא המיקום באלבום, כדי ששתי הורדות נפרדות לא יתנגשו בשם
    const n = allPhotos.findIndex((p) => p.id === photo.id) + 1;
    files.push(
      new File([blob], fileNameFor(photo, albumName, n), {
        type: blob.type || "application/octet-stream",
      })
    );
    onProgress?.(files.length);
  }
  return files;
}

/**
 * הורדה למכשיר. כמה קבצים יוצאים כהורדות נפרדות בהפרש קטן — כרום
 * שואל פעם אחת "לאפשר הורדות מרובות". אין כאן ZIP בכוונה: באייפון ZIP
 * נשמר ל"קבצים" ולא לתמונות, ושם השיתוף הוא הדרך הנכונה.
 */
export async function downloadFiles(files: File[]) {
  for (const [i, file] of files.entries()) {
    if (i > 0) await new Promise((r) => setTimeout(r, 400));
    const href = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = href;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // ספארי מתחיל את ההורדה אסינכרונית — שחרור מיידי מבטל אותה
    setTimeout(() => URL.revokeObjectURL(href), 60_000);
  }
}

/** האם אפשר לשתף קבצים ממש (גיליון השיתוף של המכשיר) */
export function canShareFiles(files: File[]): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files })
  );
}

export type ShareResult = "shared" | "cancelled" | "needs-tap" | "copied";

/**
 * שיתוף. הסדר: קבצים בגיליון השיתוף (וואטסאפ, "שמירה בתמונות") ←
 * קישורים בגיליון ← העתקת הקישורים.
 *
 * ⚠️ `navigator.share` דורש לחיצה "טרייה". ספארי מאבד אותה בזמן שמושכים
 * את הקבצים, ואז זורק `NotAllowedError` — זה `needs-tap`: הקבצים כבר
 * בזיכרון, והמסך מציג כפתור שני שקורא ל-`shareFilesNow` מיד בלחיצה.
 */
export async function shareFilesNow(
  files: File[],
  photos: GalleryPhotoRow[]
): Promise<ShareResult> {
  try {
    if (canShareFiles(files)) {
      await navigator.share({ files });
      return "shared";
    }
    const text = photos.map((p) => p.url).join("\n");
    if (typeof navigator.share === "function") {
      await navigator.share({ text });
      return "shared";
    }
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError")
      return "cancelled";
    if (err instanceof DOMException && err.name === "NotAllowedError")
      return "needs-tap";
    throw err;
  }
}

/**
 * מחיקה של כמה פריטים בבת אחת.
 *
 * ⚠️ מחיקה ש-RLS דוחה לא מחזירה שגיאה אלא 0 שורות — לכן `.select()`,
 * ומחיקת הקבצים היא רק של מה שבאמת נמחק. הסדר כמו בפריט בודד (§10):
 * קודם השורות, אחר-כך הקבצים — לכל היותר נשאר קובץ יתום, לא תמונה שבורה.
 */
export async function deletePhotos(photos: GalleryPhotoRow[]) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("gallery_photos")
    .delete()
    .in(
      "id",
      photos.map((p) => p.id)
    )
    .select("id");
  if (error) throw error;

  const deleted = new Set((data ?? []).map((r) => r.id));
  const paths = photos
    .filter((p) => deleted.has(p.id) && p.storage_path)
    .map((p) => p.storage_path as string);
  if (paths.length > 0) {
    await supabase.storage.from("gallery").remove(paths);
  }
  return deleted.size;
}
