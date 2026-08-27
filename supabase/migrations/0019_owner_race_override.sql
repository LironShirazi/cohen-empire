-- ─────────────────────────────────────────────────────────────
-- מנהל-על — שינוי סטטוס בכל כיוון ומחיקת מירוץ
-- מקור: docs/01 §2 (תפקיד מנהל-על), docs/02 §3.13
--
-- 0018 נתן למנהל-על את כל מה שמותר למנהל תורן. שתי הפעולות כאן הן
-- דווקא מה ש**אסור** גם למנהל תורן, ולכן הן פונקציות נפרדות:
--
--   1. `owner_set_race_status` — כל סטטוס לכל סטטוס, כולל **הוצאה
--      מארכיון**. `set_race_status` (0002) מסרבת לארכב, ו-
--      `archive_race` היא חד-כיוונית: הארכוב נועל את המירוץ לכולם
--      **כולל למי שארכב בטעות**, ועד היום לא הייתה שום דרך חזרה.
--   2. `owner_delete_race` — מחיקה אמיתית. מירוץ שנוצר בטעות או
--      לבדיקה נשאר עד היום לנצח ברשימה ובדף הבית (`getFeaturedRace`
--      בוחר לפי סטטוס ותאריך, ולכן מירוץ בדיקה עם תאריך עתידי דורס
--      את המירוץ האמיתי בכותרת).
--
-- ⚠️ **שתיהן `is_owner()` בלבד, לא `is_race_admin()`.** מנהל תורן
-- שיוציא מירוץ מארכיון פותח לעריכה היסטוריה של שנה אחרת, ומחיקה
-- היא בלתי הפיכה. זה בדיוק הקו שבו מנהל-על נבדל ממנהל תורן
-- (docs/01 §2) — כמו התוכן המשפחתי הקבוע ב-0014.
--
-- ⚠️ **`is_race_admin` נשאר חוסם ארכיון.** הדרך לערוך מירוץ מארכב
-- היא להוציא אותו מהארכיון קודם — פעולה מודעת, ולא היתר שקט
-- שנפתח לכל עריכה.
-- ─────────────────────────────────────────────────────────────

create or replace function public.owner_set_race_status(
  p_race_id uuid,
  p_status public.race_status
)
returns public.races
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_race public.races;
begin
  if not public.is_owner() then
    raise exception 'רק מנהל-על רשאי לשנות סטטוס של מירוץ בכל כיוון';
  end if;

  update public.races set status = p_status where id = p_race_id
  returning * into v_race;

  if v_race.id is null then
    raise exception 'המירוץ לא נמצא';
  end if;

  return v_race;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- מחיקת מירוץ
--
-- כל מה שתלוי במירוץ נמחק איתו ב-cascade שהוגדר כבר ב-0001:
-- קבוצות ← חברי קבוצה, התקדמות, סדר תחנות, הודעות, מיקומים;
-- וגם תחנות, בקשות הצטרפות, מנהלים תורנים והתראות.
--
-- ⚠️ **מה ש*לא* נמחק, בכוונה:** ל-`hall_of_fame.race_id` ול-
-- `gallery_photos.race_id` יש `on delete set null` (0001). שורת
-- היכל התהילה של אותה שנה **שורדת** את מחיקת המירוץ והופכת לשורה
-- "שהוזנה מהזיכרון" — זיכרון המשפחה אינו נתון של המירוץ. מי
-- שמוחק מירוץ בדיקה שהספיק להכריז זוכים צריך למחוק את השורה
-- בנפרד ב-`/admin/content`.
--
-- ⚠️ **קבצים ב-Storage נשארים יתומים** (הוכחות, קבצי צ'אט, מדיה
-- של תחנות) — אותו חוב ידוע של `chat-files` ו-`station-media`
-- (CLAUDE.md §9). מדיניות ה-Storage מרשה מחיקת קובץ רק לבעליו,
-- ופונקציה שתמחק קבצים של אחרים היא פיצ'ר בפני עצמו.
-- ─────────────────────────────────────────────────────────────
create or replace function public.owner_delete_race(p_race_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_owner() then
    raise exception 'רק מנהל-על רשאי למחוק מירוץ';
  end if;

  delete from public.races where id = p_race_id;

  if not found then
    raise exception 'המירוץ לא נמצא';
  end if;
end;
$$;

revoke execute on function
  public.owner_set_race_status(uuid, public.race_status),
  public.owner_delete_race(uuid)
  from public, anon;

grant execute on function
  public.owner_set_race_status(uuid, public.race_status),
  public.owner_delete_race(uuid)
  to authenticated;
