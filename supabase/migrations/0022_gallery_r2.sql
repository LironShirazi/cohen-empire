-- ─────────────────────────────────────────────────────────────
-- הגלריה עוברת ל-Cloudflare R2
--
-- במסלול החינמי ל-Supabase יש 1GB לכל ה-Storage של הפרויקט — הגלריה,
-- הצ'אט, ההוכחות והתוכן המשפחתי יחד — ו-5GB תעבורה בחודש. סרטון בגלריה
-- הוא עד 50MB, ועשרים כאלה ממלאים הכל. ב-R2 עשרת ה-GB הראשונים חינם
-- והתעבורה חינם תמיד, ולכן כל העלאה **חדשה** לגלריה הולכת לשם
-- (`/api/gallery/upload`). קבצים קיימים נשארים ב-Supabase ולא זזים.
--
-- ⚠️ R2 הוא לגלריה בלבד: הצ'אט, ההוכחות והתוכן המשפחתי נשענים על
-- מדיניות ה-Storage (תיקייה לפי קבוצה, מנהל-על בלבד), ול-R2 אין
-- מקבילה לזה. בגלריה ההרשאה פשוטה — כל בן משפחה מחובר — ולכן היא
-- נבדקת בראוט בלי לאבד כלום.
-- ─────────────────────────────────────────────────────────────

-- איפה הקובץ יושב — כדי שמחיקה תדע לאן לפנות. ברירת המחדל מכסה את כל
-- השורות שקדמו למיגרציה הזו
alter table public.gallery_photos
  add column if not exists storage_provider text not null default 'supabase';

alter table public.gallery_photos
  drop constraint if exists gallery_photos_storage_provider_valid;
alter table public.gallery_photos
  add constraint gallery_photos_storage_provider_valid
  check (storage_provider in ('supabase', 'r2'));

-- ⚠️ מחוץ ל-`grant update (caption, album_id)` של 0013 בכוונה: שורה
-- שתסומן ספק אחר תשלח את המחיקה לקובץ הלא נכון
