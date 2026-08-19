-- ─────────────────────────────────────────────────────────────
-- שם משפחה לעלה בעץ
--
-- שדה פר-אדם ולא פר-זוג, למרות שהתצוגה היא מתחת ללב של בני הזוג:
-- במשפחה גדולה יש כלות וחתנים ששמרו על שם המשפחה שלהם, ואישה
-- ששינתה אחרי החתונה עדיין צריכה שם משלה בתצוגה המוגדלת. הזוג הוא
-- מקום התצוגה, לא הבעלים של הנתון — אם שני בני הזוג חולקים שם הוא
-- יוצג פעם אחת, ואם לא, יוצגו שניהם.
-- ─────────────────────────────────────────────────────────────

alter table public.family_members
  add column if not exists last_name text;

alter table public.family_members
  drop constraint if exists family_members_last_name_len;
alter table public.family_members
  add constraint family_members_last_name_len
  check (last_name is null or length(btrim(last_name)) between 1 and 40);
