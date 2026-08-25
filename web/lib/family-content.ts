import { createClient } from "@/lib/supabase/client";
import { GALLERY_IMAGE_MAX_BYTES, GALLERY_IMAGE_MAX_MB, prepareImage } from "@/lib/image";

/**
 * העלאת תמונות לתוכן המשפחתי הקבוע — קריקטורה שמלווה משפט
 * (`quotes.image_url`) ותמונת הקבוצה הזוכה (`hall_of_fame.photo_url`).
 *
 * bucket אחד לשני הפיצ'רים (מיגרציה 0014): אותו סוג נכס, אותה מדיניות
 * (מנהל-על בלבד), ואין טעם בשתי מדיניויות זהות לתחזק.
 *
 * ⚠️ **תמונות בלבד — אין כאן סרטונים.** לכן בניגוד לגלריה (CLAUDE.md §10)
 * אין כאן שתי תקרות: `GALLERY_IMAGE_MAX_BYTES` היא התקרה היחידה, והיא
 * זהה ל-`file_size_limit` של ה-bucket.
 */
export const FAMILY_CONTENT_BUCKET = "family-content";

/** מעלה תמונה מוקטנת ומחזיר את ה-URL הציבורי שלה */
export async function uploadFamilyImage(
  file: File,
  folder: "quotes" | "hall-of-fame"
): Promise<string> {
  const { blob, extension } = await prepareImage(file);

  if (blob.size > GALLERY_IMAGE_MAX_BYTES) {
    throw new Error(`${file.name} גדול מדי (מעל ${GALLERY_IMAGE_MAX_MB}MB)`);
  }

  const supabase = createClient();
  const path = `${folder}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage
    .from(FAMILY_CONTENT_BUCKET)
    .upload(path, blob, {
      upsert: false,
      contentType: blob.type || "application/octet-stream",
    });
  if (error) throw error;

  return supabase.storage.from(FAMILY_CONTENT_BUCKET).getPublicUrl(path).data
    .publicUrl;
}

/**
 * הנתיב ב-bucket מתוך ה-URL הציבורי.
 *
 * בניגוד ל-`gallery_photos`, ל-`quotes` ול-`hall_of_fame` אין עמודת
 * `storage_path` (הן מ-0001 ולא נוספה להן אחת) — ולכן הנתיב נגזר מה-URL,
 * שתמיד בצורה `.../object/public/family-content/<path>`.
 *
 * מחזיר `null` לכל URL שאינו מה-bucket הזה — למשל קישור חיצוני, או
 * תמונה שנשארה מ-bucket אחר. מי שלא שלנו — לא מוחקים.
 */
export function familyStoragePath(url: string): string | null {
  const marker = `/object/public/${FAMILY_CONTENT_BUCKET}/`;
  const at = url.indexOf(marker);
  if (at === -1) return null;
  return decodeURIComponent(url.slice(at + marker.length));
}

/**
 * מחיקת הקובץ מה-bucket. **תמיד אחרי מחיקת/עדכון השורה**, לא לפני —
 * השורה היא מה שהמסך קורא, ואם נמחק קודם הקובץ והשורה תישאר, נשארת
 * תמונה שבורה על המסך (אותו כלל כמו בגלריה, CLAUDE.md §10).
 *
 * הכיוון הזה משאיר לכל היותר קובץ יתום — חוב מוכר, לא תקלה חדשה.
 */
export async function deleteFamilyImage(url: string | null): Promise<void> {
  if (!url) return;
  const path = familyStoragePath(url);
  if (!path) return;
  await createClient().storage.from(FAMILY_CONTENT_BUCKET).remove([path]);
}
