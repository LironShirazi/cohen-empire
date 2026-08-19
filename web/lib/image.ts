/**
 * הקטנת תמונה בדפדפן לפני העלאה לגלריה.
 *
 * למה בכלל: תמונה מהטלפון היא 3–6MB, והגלריה נטענת בשלמותה במסך אחד.
 * 1600px מספיק לצפייה מלאה בנייד ובמחשב, ומוריד תמונה טיפוסית לכ-300KB.
 *
 * ⚠️ זה שיפור חוויה, לא שכבת אבטחה — תקרת הגודל האמיתית נאכפת
 * ב-bucket עצמו (מיגרציה 0012), כי קריאת API ישירה לא עוברת כאן.
 */

export const GALLERY_MAX_PX = 1600;
export const GALLERY_MAX_MB = 10;
export const GALLERY_MAX_BYTES = GALLERY_MAX_MB * 1024 * 1024;

export type PreparedImage = { blob: Blob; extension: string };

function extensionOf(file: File): string {
  return file.name.split(".").pop()?.toLowerCase() || "jpg";
}

/**
 * מחזיר את מה שצריך להעלות. אם הדפדפן לא יודע לפענח את התמונה
 * (HEIC של אייפון בדפדפן שאינו ספארי, למשל) — מעלים את הקובץ המקורי
 * כמו שהוא, כי תמונה כבדה עדיפה על העלאה שנכשלת.
 */
export async function prepareImage(
  file: File,
  maxPx = GALLERY_MAX_PX
): Promise<PreparedImage> {
  const original: PreparedImage = { blob: file, extension: extensionOf(file) };

  // GIF מונפש היה מאבד את התנועה בציור לקנבס
  if (file.type === "image/gif") return original;

  try {
    // imageOrientation — בלעדיו תמונה מהטלפון מגיעה מסובבת ב-90°:
    // הסיבוב יושב ב-EXIF ולא בפיקסלים
    const bitmap = await createImageBitmap(file, {
      imageOrientation: "from-image",
    });
    const k = Math.min(1, maxPx / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * k);
    const height = Math.round(bitmap.height * k);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return original;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.85)
    );
    if (!blob) return original;

    // קובץ שכבר היה קטן ומיטבי — אין טעם להחליף אותו בגרסה כבדה יותר
    if (blob.size >= file.size && k === 1) return original;
    return { blob, extension: "jpg" };
  } catch {
    return original;
  }
}
