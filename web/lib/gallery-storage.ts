import { createClient } from "@/lib/supabase/client";
import type { GalleryPhoto } from "@/lib/supabase/types";

/**
 * איפה קובץ של הגלריה יושב, ואיך מגיעים אליו — מהדפדפן.
 *
 * מיגרציה 0022: העלאה חדשה הולכת ל-R2, ו-`/api/gallery/upload` מחליט
 * (ונופל ל-Supabase כשאין מפתחות R2). שורות ישנות נשארות ב-Supabase,
 * ולכן המחיקה פונה לפי `storage_provider` של השורה ולא לפי מה שנכון היום.
 */

export type StorageProvider = GalleryPhoto["storage_provider"];

export type UploadedFile = {
  provider: StorageProvider;
  path: string;
  url: string;
};

async function errorOf(response: Response, fallback: string) {
  const body = await response.json().catch(() => null);
  return new Error(body?.error ?? fallback);
}

export async function uploadGalleryFile(
  albumId: string,
  blob: Blob,
  extension: string
): Promise<UploadedFile> {
  const contentType = blob.type || "application/octet-stream";
  const response = await fetch("/api/gallery/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ albumId, extension, contentType, size: blob.size }),
  });
  if (!response.ok) throw await errorOf(response, "ההעלאה נכשלה");
  const plan = await response.json();

  if (plan.provider === "r2") {
    // ה-Content-Type חייב להיות זהה למה שנחתם, אחרת R2 דוחה את החתימה
    const put = await fetch(plan.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": plan.contentType },
      body: blob,
    });
    if (!put.ok) throw new Error("ההעלאה נכשלה — ננסה שוב?");
    return { provider: "r2", path: plan.path, url: plan.publicUrl };
  }

  const supabase = createClient();
  const { error } = await supabase.storage
    .from("gallery")
    .upload(plan.path, blob, { upsert: false, contentType });
  if (error) throw error;
  const { data } = supabase.storage.from("gallery").getPublicUrl(plan.path);
  return { provider: "supabase", path: plan.path, url: data.publicUrl };
}

/**
 * מוחק את הקובץ. ⚠️ ב-R2 זה מצליח רק אחרי שהשורה כבר נמחקה — הראוט
 * מוחק רק קובץ שאף שורה לא מצביעה עליו. כישלון כאן משאיר לכל היותר
 * קובץ יתום, ולכן הוא לא נזרק הלאה (אותו חוב של `chat-files`, §9).
 */
export async function removeGalleryFile(provider: StorageProvider, path: string) {
  if (provider === "r2") {
    await fetch("/api/gallery/upload", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path }),
    }).catch(() => undefined);
    return;
  }
  await createClient().storage.from("gallery").remove([path]);
}
