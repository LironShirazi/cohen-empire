-- ─────────────────────────────────────────────────────────────
-- כמה תמונות למתכון, לא אחת
--
-- `photo_url` + `thumb_url` נשארות התמונה **הראשית**: היא מה שהספר
-- מציג בשורה, והממוזערת נגזרת רק ממנה. התמונות הנוספות יושבות
-- במערך לפי סדר התצוגה, ומוצגות אחרי הראשית בגלריה בראש דף המתכון.
--
-- עד 9 נוספות (10 בסך הכל) — מתכון, לא אלבום. אלבום שלם של אירוע
-- שייך לגלריה המשפחתית (CLAUDE.md §10).
--
-- מחיקת שאלה/תשובה לא צריכה כאן כלום: `recipe_questions_delete` (0023)
-- כבר מתירה לשואל ולמנהל-על, וניקוי תשובה עובר ב-`answer_recipe_question`
-- עם טקסט ריק.
-- ─────────────────────────────────────────────────────────────

alter table public.recipes
  add column if not exists extra_photo_urls text[] not null default '{}';

alter table public.recipes
  drop constraint if exists recipes_extra_photos_len;
alter table public.recipes
  add constraint recipes_extra_photos_len check (cardinality(extra_photo_urls) <= 9);

-- הרשאה ברמת העמודה (0023) — העמודה החדשה חייבת להיכנס לרשימה,
-- אחרת עריכה של מתכון שנוגעת בה נדחית ב-42501
grant update (extra_photo_urls) on public.recipes to authenticated;
