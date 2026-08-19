-- ─────────────────────────────────────────────────────────────
-- שלב 3 — גלריית התמונות
-- מקור: docs/01 §7 ("מסך ניהול והעלאת תמונות מהמירוצים, מסודר לפי
-- שנים"), docs/04 §26, docs/05 שלב 3
--
-- ⚠️ הטבלה `gallery_photos` **כבר קיימת מ-0001** (docs/03) עם RLS
-- מופעל ומדיניות קריאה בלבד — כלומר עד היום היא ריקה ואי אפשר היה
-- לכתוב אליה כלל. המיגרציה הזו משלימה את מה שחסר: שנה מפורשת,
-- נתיב הקובץ ב-Storage, מדיניות כתיבה, ה-bucket והאינדקס.
-- ─────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────
-- 1. שנה מפורשת ולא רק דרך המירוץ
--
-- הגלריה מסודרת לפי שנים, אבל ל-20 שנות המסורת שקדמו לאפליקציה אין
-- שורת `races` בכלל — ו-`race_id` שלהן יישאר null לנצח. גם למירוץ
-- שקיים, `race_id` הוא `on delete set null` (0001), כך שמחיקת מירוץ
-- הייתה מוחקת את השיוך של התמונות לשנה שלהן. לכן השנה נשמרת בשורה.
--
-- כשיש מירוץ, הטריגר למטה הוא הקובע — הקליינט לא יכול לטעון ששנת
-- התמונה שונה משנת המירוץ שאליו שייך אותה תמונה.
-- ─────────────────────────────────────────────────────────────

alter table public.gallery_photos
  add column if not exists year int,
  -- הנתיב ב-bucket, כדי שמחיקת שורה תוכל למחוק גם את הקובץ עצמו.
  -- בלעדיו נשארים קבצים יתומים — החוב שכבר קיים ב-chat-files (CLAUDE.md §9)
  add column if not exists storage_path text;

update public.gallery_photos g
  set year = r.year
  from public.races r
  where g.race_id = r.id and g.year is null;

-- מה שנשאר בלי שנה ובלי מירוץ — לפי שנת ההעלאה
update public.gallery_photos
  set year = extract(year from created_at)::int
  where year is null;

alter table public.gallery_photos
  alter column year set not null;

alter table public.gallery_photos
  drop constraint if exists gallery_photos_year_valid;
alter table public.gallery_photos
  add constraint gallery_photos_year_valid check (year between 1990 and 2200);

alter table public.gallery_photos
  drop constraint if exists gallery_photos_caption_len;
alter table public.gallery_photos
  add constraint gallery_photos_caption_len check (
    caption is null or length(btrim(caption)) between 1 and 140
  );

-- הסדר שבו הגלריה נקראת תמיד: שנה יורדת, ובתוכה החדש למעלה
create index if not exists gallery_photos_year_idx
  on public.gallery_photos (year desc, created_at desc);

-- שנת התמונה = שנת המירוץ שלה. `security definer` כי הקורא לא בהכרח
-- רשאי לקרוא את `races` של מירוץ אחר
create or replace function public.sync_gallery_photo_year()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.race_id is not null then
    select r.year into new.year from public.races r where r.id = new.race_id;
  end if;
  return new;
end;
$$;

drop trigger if exists gallery_photos_sync_year on public.gallery_photos;
create trigger gallery_photos_sync_year
  before insert or update of race_id, year on public.gallery_photos
  for each row execute function public.sync_gallery_photo_year();

-- ─────────────────────────────────────────────────────────────
-- 2. מי מנהל את הגלריה
--
-- docs/04 §26: "העלאה ע"י כל משתתף, ניהול (מחיקה/כותרות) ע"י מנהלים".
--
-- ⚠️ `is_race_admin` מחזיר false למירוץ בארכיון (0002) — וזה בדיוק
-- המצב הרגיל בגלריה, שרובה תמונות של מירוצי עבר. כלומר בפועל
-- **מנהל-על** הוא שמנהל את הגלריה ההיסטורית, והמנהל התורן מנהל רק
-- את התמונות של המירוץ שהוא עדיין מנהל. זה עקבי עם docs/01 §2
-- ("מירוצי עבר נעולים לעריכה") ועם ניהול התוכן הקבוע שם.
--
-- **העלאה** לעומת זאת פתוחה תמיד, גם למירוץ בארכיון: אנשים מעלים
-- תמונות מהמירוץ אחרי שהוא נגמר, וזו כל מהות הגלריה.
-- ─────────────────────────────────────────────────────────────

create or replace function public.can_manage_gallery(p_race_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select public.is_owner()
      or (p_race_id is not null and public.is_race_admin(p_race_id));
$$;

-- ─────────────────────────────────────────────────────────────
-- 3. מדיניות כתיבה
-- ─────────────────────────────────────────────────────────────

-- כל בן משפחה מחובר מעלה — ובשמו שלו בלבד
drop policy if exists gallery_insert on public.gallery_photos;
create policy gallery_insert on public.gallery_photos for insert to authenticated
  with check (uploaded_by = (select auth.uid()));

-- כותרת: מי שהעלה מתקן את עצמו, ומנהל מתקן את כולם
drop policy if exists gallery_update on public.gallery_photos;
create policy gallery_update on public.gallery_photos for update to authenticated
  using (
    uploaded_by = (select auth.uid())
    or public.can_manage_gallery(race_id)
  )
  with check (
    uploaded_by = (select auth.uid())
    or public.can_manage_gallery(race_id)
  );

drop policy if exists gallery_delete on public.gallery_photos;
create policy gallery_delete on public.gallery_photos for delete to authenticated
  using (
    uploaded_by = (select auth.uid())
    or public.can_manage_gallery(race_id)
  );

-- ⚠️ הרשאה ברמת העמודה, ולא רק RLS: בלעדיה מי שהעלה תמונה יכול היה
-- לעדכן בשורה שלו גם את `url` (להצביע על קובץ אחר) או את `uploaded_by`.
-- RLS מחליט על אילו **שורות** מותר לכתוב, לא על אילו עמודות.
revoke update on public.gallery_photos from authenticated;
grant update (caption, year, race_id) on public.gallery_photos to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 4. ה-bucket
-- ─────────────────────────────────────────────────────────────

do $$
begin
  if exists (select 1 from information_schema.tables
             where table_schema = 'storage' and table_name = 'objects') then

    -- תקרת הגודל נאכפת ב-Storage עצמו ולא רק בקליינט (כמו chat-files
    -- ב-0005): בלי זה אפשר לעקוף את ההקטנה שבדפדפן בקריאת API ישירה.
    -- 10MB — התמונות מוקטנות ל-1600px לפני ההעלאה, וזה מרווח בטוח גם
    -- לתמונה שהדפדפן לא הצליח לפענח והועלתה כמו שהיא
    insert into storage.buckets (id, name, public, file_size_limit)
    values ('gallery', 'gallery', true, 10485760)
    on conflict (id) do update
      set public = excluded.public,
          file_size_limit = excluded.file_size_limit;

    drop policy if exists gallery_files_read on storage.objects;
    create policy gallery_files_read on storage.objects for select
      using (bucket_id = 'gallery');

    drop policy if exists gallery_files_insert on storage.objects;
    create policy gallery_files_insert on storage.objects for insert to authenticated
      with check (bucket_id = 'gallery');

    -- `owner` הוא מי שהעלה את הקובץ (Storage ממלא אותו מ-auth.uid()).
    -- התיקייה כאן היא השנה ולא מזהה שאפשר לבדוק עליו הרשאה, כמו
    -- שנעשה ב-chat-files — ולכן הבעלות היא מה שמאפשר למעלה למחוק
    -- את הקובץ שלו, ולמנהל-על למחוק כל קובץ
    drop policy if exists gallery_files_delete on storage.objects;
    create policy gallery_files_delete on storage.objects for delete to authenticated
      using (
        bucket_id = 'gallery'
        and (owner = (select auth.uid()) or public.is_owner())
      );
  end if;
end $$;
