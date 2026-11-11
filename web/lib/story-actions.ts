import { createClient } from "@/lib/supabase/client";
import { GALLERY_IMAGE_MAX_BYTES, prepareImage } from "@/lib/image";
import { STORIES_BUCKET, STORY_MAX_PX, type StoryItem } from "@/lib/stories";
import type { Story } from "@/lib/supabase/types";

/**
 * פעולות הסטוריז מהדפדפן (0024). הכתיבה ישירה מול RLS — כמו הצ'אט
 * והגלריה: אין מה לאמת מעבר לזהות המעלה, והמדיניות אוכפת אותה.
 */

/**
 * השורה שנשמרה, בצורה שהפס מציג. הפס מוסיף אותה מיד — בלי לחכות
 * לרענון מהשרת, שבנייד לא תמיד הגיע וחייב רענון ידני של העמוד.
 */
function toItem(
  supabase: ReturnType<typeof createClient>,
  row: Story
): StoryItem {
  return {
    id: row.id,
    kind: row.kind,
    storage_path: row.storage_path,
    url: row.storage_path
      ? supabase.storage.from(STORIES_BUCKET).getPublicUrl(row.storage_path).data.publicUrl
      : null,
    caption: row.caption,
    color: row.color,
    created_at: row.created_at,
  };
}

/** מעלה תמונה מוקטנת לתיקייה של המעלה ושומר את השורה */
export async function postPhotoStory(
  userId: string,
  file: File,
  caption: string
): Promise<StoryItem> {
  const { blob, extension } = await prepareImage(file, STORY_MAX_PX);
  if (blob.size > GALLERY_IMAGE_MAX_BYTES) {
    throw new Error("התמונה גדולה מדי");
  }

  const supabase = createClient();
  const path = `${userId}/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from(STORIES_BUCKET)
    .upload(path, blob, {
      upsert: false,
      contentType: blob.type || "image/jpeg",
    });
  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from("stories")
    .insert({
      user_id: userId,
      kind: "photo",
      storage_path: path,
      caption: caption.trim() || null,
    })
    .select()
    .single();
  // השורה נכשלה — הקובץ מיותר, וזו ההזדמנות היחידה לנקות אותו
  if (error) {
    await supabase.storage.from(STORIES_BUCKET).remove([path]);
    throw error;
  }
  return toItem(supabase, data as Story);
}

/** "טקסט על צבע" — בלי קובץ בכלל, רק המשפט ומספר הצבע */
export async function postTextStory(
  userId: string,
  text: string,
  color: number
): Promise<StoryItem> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("stories")
    .insert({
      user_id: userId,
      kind: "text",
      caption: text.trim(),
      color,
    })
    .select()
    .single();
  if (error) throw error;
  return toItem(supabase, data as Story);
}

/** קודם השורה, אחר-כך הקובץ — אותו סדר כמו בגלריה (CLAUDE.md §10) */
export async function deleteStory(item: StoryItem): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("stories").delete().eq("id", item.id);
  if (error) throw error;
  if (item.storage_path) {
    await supabase.storage.from(STORIES_BUCKET).remove([item.storage_path]);
  }
}

/**
 * רישום צפייה. צפייה חוזרת נדחית על המפתח הראשי (23505) — וזה בדיוק
 * "צפייה חוזרת לא מוסיפה שורה", לא שגיאה. לא `upsert`: הוא דורש גם
 * הרשאת UPDATE, ואין כזו על `story_views` בכוונה.
 */
export async function markStoryViewed(storyId: string): Promise<void> {
  const { error } = await createClient()
    .from("story_views")
    .insert({ story_id: storyId });
  if (error && error.code !== "23505") {
    console.warn("story view not recorded", error.message);
  }
}

/**
 * ניקוי הסטוריז שלי שפגו — השורות נמחקות בשרת והנתיבים חוזרים לכאן
 * כדי למחוק את הקבצים (למה לא pg_cron: ההערה ב-0024). פעם אחת לסשן.
 */
export async function purgeMyExpiredStories(): Promise<void> {
  const flag = "stories-purged";
  try {
    if (sessionStorage.getItem(flag)) return;
    sessionStorage.setItem(flag, "1");
  } catch {
    // בלי sessionStorage (גלישה פרטית) — פשוט מנקים בכל טעינה
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc("take_my_expired_stories");
  if (error) return;
  const paths = ((data ?? []) as (string | null)[]).filter(
    (p): p is string => !!p
  );
  if (paths.length) await supabase.storage.from(STORIES_BUCKET).remove(paths);
}
