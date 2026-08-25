-- ─────────────────────────────────────────────────────────────
-- שלב 3 — תוכן משפחתי קבוע: משפטי סבא וסבתא + היכל התהילה
--
-- שתי הטבלאות קיימות מ-0001 ומעולם לא נפתחו לכתיבה: היו להן רק
-- `quotes_read` ו-`hall_of_fame_read`. המיגרציה הזו נותנת להן בעלים.
--
-- ⚠️ **הבעלים הוא מנהל-על, לא "כל המשפחה"** — וזה בכוונה שונה מהגלריה
-- ומהעץ. docs/01 §2 מגדיר את זה כתפקיד: "מנהל-על (Owner) — ניהול תוכן
-- קבוע (משפטי סבא וסבתא, היכל התהילה)". אלבום הוא של מי שפתח אותו,
-- אבל משפט שמיוחס לסבא ז"ל ושורת זוכים משנת 2009 הם **מסמך משפחתי**:
-- מי שמתקן אותם קובע מה המשפחה תזכור. לכן `public.is_owner()` ולא
-- `created_by = auth.uid()`.
--
-- מה שכבר עובד ולא נוגעים בו: `finish_race` (0002) כבר עושה upsert
-- ל-`hall_of_fame` בסיום מירוץ. ההוספה האוטומטית קיימת — מה שחסר היה
-- נתיב הקריאה באפליקציה והזנת 20 שנות ההיסטוריה שקדמו לה.
-- ─────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────
-- 1. משפטי סבא וסבתא
-- ─────────────────────────────────────────────────────────────

-- ציטוט הוא משפט שנאמר, לא נאום. 280 תווים מספיקים בנוחות ומונעים
-- פסקה שתשבור את הבלוק הצהוב בדף הבית
alter table public.quotes
  drop constraint if exists quotes_text_len;
alter table public.quotes
  add constraint quotes_text_len
  check (length(btrim(text)) between 1 and 280);

drop policy if exists quotes_insert on public.quotes;
create policy quotes_insert on public.quotes for insert to authenticated
  with check (public.is_owner());

drop policy if exists quotes_update on public.quotes;
create policy quotes_update on public.quotes for update to authenticated
  using (public.is_owner()) with check (public.is_owner());

drop policy if exists quotes_delete on public.quotes;
create policy quotes_delete on public.quotes for delete to authenticated
  using (public.is_owner());

-- RLS מחליט על אילו **שורות** מותר לכתוב, לא על אילו עמודות (אותו
-- טעם כמו בגלריה ב-0012/0013). כאן זה שומר על `created_at` — סדר
-- הכניסה של המשפטים הוא התיעוד היחיד של מתי מישהו נזכר בהם
revoke update on public.quotes from authenticated;
grant update (text, who, image_url) on public.quotes to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 2. היכל התהילה
-- ─────────────────────────────────────────────────────────────

drop policy if exists hall_of_fame_insert on public.hall_of_fame;
create policy hall_of_fame_insert on public.hall_of_fame for insert to authenticated
  with check (public.is_owner());

drop policy if exists hall_of_fame_update on public.hall_of_fame;
create policy hall_of_fame_update on public.hall_of_fame for update to authenticated
  using (public.is_owner()) with check (public.is_owner());

drop policy if exists hall_of_fame_delete on public.hall_of_fame;
create policy hall_of_fame_delete on public.hall_of_fame for delete to authenticated
  using (public.is_owner());

-- ⚠️ `race_id` **מחוץ לרשימה בכוונה.** הוא נכתב אך ורק ע"י `finish_race`,
-- והוא מה שמבדיל שורה שהמערכת יצרה משורה שהוזנה מהזיכרון. בלי ההגבלה
-- הזו "תיקון שם קבוצה" בשנת 2008 היה יכול לקשור אותה למירוץ אקראי,
-- ומאותו רגע `finish_race` היה דורס אותה.
--
-- `finish_race` הוא security definer ורץ כבעל הפונקציה — ה-grants
-- האלה לא חוסמים אותו.
revoke update on public.hall_of_fame from authenticated;
grant update (year, team_name, team_color, members, photo_url)
  on public.hall_of_fame to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 3. ה-bucket — אחד לשני הפיצ'רים
--
-- `quotes.image_url` (קריקטורה שמלווה משפט) ו-`hall_of_fame.photo_url`
-- (תמונת הקבוצה הזוכה לכל שנה) הם אותו סוג נכס בדיוק: תמונה של תוכן
-- קבוע שרק מנהל-על מעלה. bucket נפרד לכל אחד מהם היה שתי מדיניויות
-- זהות לתחזק.
--
-- 10MB ולא 50MB כמו `gallery`: שם התקרה הגבוהה קיימת בשביל סרטונים,
-- וכאן אין סרטונים בכלל. זו בדיוק `GALLERY_IMAGE_MAX_BYTES` שבקליינט
-- (`web/lib/image.ts`) — התמונות מוקטנות ל-1600px לפני ההעלאה, וזה
-- מרווח בטוח גם לתמונה שהדפדפן לא פיענח והועלתה כמו שהיא.
-- ─────────────────────────────────────────────────────────────

do $$
begin
  if exists (select 1 from information_schema.tables
             where table_schema = 'storage' and table_name = 'objects') then

    insert into storage.buckets (id, name, public, file_size_limit)
    values ('family-content', 'family-content', true, 10485760)
    on conflict (id) do update
      set public = excluded.public,
          file_size_limit = excluded.file_size_limit;

    drop policy if exists family_content_read on storage.objects;
    create policy family_content_read on storage.objects for select
      using (bucket_id = 'family-content');

    -- בניגוד ל-gallery, גם ההעלאה מוגבלת: התוכן הקבוע הוא של מנהל-על
    drop policy if exists family_content_insert on storage.objects;
    create policy family_content_insert on storage.objects for insert to authenticated
      with check (bucket_id = 'family-content' and public.is_owner());

    drop policy if exists family_content_delete on storage.objects;
    create policy family_content_delete on storage.objects for delete to authenticated
      using (bucket_id = 'family-content' and public.is_owner());
  end if;
end $$;
