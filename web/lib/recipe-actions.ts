import { createClient } from "@/lib/supabase/client";
import { GALLERY_IMAGE_MAX_BYTES, GALLERY_IMAGE_MAX_MB, prepareImage } from "@/lib/image";
import type { Recipe } from "@/lib/supabase/types";

/**
 * העלאה ומחיקה של תמונות המתכונים מהדפדפן (bucket `recipes`, 0023).
 * כל אחד כותב רק לתיקייה ששמה המזהה שלו — המדיניות אוכפת.
 */
export const RECIPES_BUCKET = "recipes";

export async function uploadRecipeImage(
  userId: string,
  file: File,
  maxPx: number
): Promise<string> {
  const { blob, extension } = await prepareImage(file, maxPx);
  if (blob.size > GALLERY_IMAGE_MAX_BYTES) {
    throw new Error(`${file.name} גדול מדי (מעל ${GALLERY_IMAGE_MAX_MB}MB)`);
  }

  const supabase = createClient();
  const path = `${userId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from(RECIPES_BUCKET).upload(path, blob, {
    upsert: false,
    contentType: blob.type || "image/jpeg",
  });
  if (error) throw error;
  return supabase.storage.from(RECIPES_BUCKET).getPublicUrl(path).data.publicUrl;
}

/** הנתיב ב-bucket מתוך ה-URL הציבורי — אותו רעיון כמו `familyStoragePath` */
export function recipeStoragePath(url: string | null): string | null {
  if (!url) return null;
  const marker = `/object/public/${RECIPES_BUCKET}/`;
  const at = url.indexOf(marker);
  return at === -1 ? null : decodeURIComponent(url.slice(at + marker.length));
}

/** קבצים בלבד — **אחרי** שהשורה נמחקה (CLAUDE.md §10) */
export async function deleteRecipeFiles(
  recipe: Pick<Recipe, "photo_url" | "thumb_url" | "extra_photo_urls" | "steps">
): Promise<void> {
  await removeRecipeUrls([
    recipe.photo_url,
    recipe.thumb_url,
    ...(recipe.extra_photo_urls ?? []),
    ...recipe.steps.map((s) => s.image_url),
  ]);
}

export async function removeRecipeUrls(urls: (string | null)[]): Promise<void> {
  const paths = urls.map(recipeStoragePath).filter((p): p is string => !!p);
  if (paths.length) await createClient().storage.from(RECIPES_BUCKET).remove(paths);
}
