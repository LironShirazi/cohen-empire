-- ─────────────────────────────────────────────────────────────
-- שלב 2 — משתתפים ידניים בהרכב הקבוצה
-- מקור: docs/01 §3.4 ("ילדים קטנים או מי שבלי טלפון… בלי חשבון"),
-- docs/04 §4 ("הוספת משתתפים ידניים"), docs/05 שלב 2
--
-- `team_members.user_id` כבר nullable מ-0001, ו-null פירושו בדיוק
-- "משתתף ידני". מה שחסר היה דרך להוסיף שורה כזו: על הטבלה הופעל RLS
-- ב-0001 בלי אף מדיניות כתיבה, והשורות היחידות שנוצרו עד היום הגיעו
-- מ-`decide_join_request` (security definer) בעקבות אישור בקשה.
--
-- **המדיניות מוגבלת ל-`user_id is null` בכוונה.** מחיקה או עריכה של
-- חבר *רשום* דרך הטבלה הזו הייתה משאירה מאחור `join_requests` מאושרת,
-- ובגלל `unique (race_id, user_id)` שם הוא לא היה יכול לבקש להצטרף
-- מחדש — משתתף תקוע באמצע מירוץ. הוצאת משתתף רשום היא פיצ'ר בפני
-- עצמו (שצריך לטפל גם בבקשה), ולא תופעת לוואי של המסך הזה.
--
-- `is_team_race_admin` חוסם גם מירוץ בארכיון — הרכב של מירוץ שהסתיים
-- הוא היסטוריה, לא טופס.
-- ─────────────────────────────────────────────────────────────

drop policy if exists team_members_manual_write on public.team_members;
create policy team_members_manual_write on public.team_members
  for all to authenticated
  using (user_id is null and public.is_team_race_admin(team_id))
  with check (user_id is null and public.is_team_race_admin(team_id));

-- למשתתף ידני השם הוא כל מה שיש — שורה בלי שם היא שורה ריקה במסך.
-- החוק מוגבל לשורות הידניות ולא חל על חבר רשום, שיש לו פרופיל ליפול
-- אליו; אחרת הוספת החוק הייתה עלולה לשבור את אישור ההצטרפות למי
-- שהשם בחשבון Google שלו ריק.
alter table public.team_members
  drop constraint if exists team_members_manual_needs_name;

alter table public.team_members
  add constraint team_members_manual_needs_name
  check (user_id is not null or btrim(display_name) <> '');
