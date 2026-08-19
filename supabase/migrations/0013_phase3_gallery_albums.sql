-- ─────────────────────────────────────────────────────────────
-- שלב 3 — הגלריה עוברת לאלבומים
--
-- ב-0012 הגלריה סודרה לפי שנה, בהנחה שהתמונות הן של המירוץ. ההנחה
-- הזו לא נכונה: הגלריה היא של **המשפחה** לכל שימוש — חתונה, בר מצווה,
-- טיול — ולא רק של יום העצמאות. לכן היחידה היא אלבום ששם לו שם חופשי,
-- וכל בן משפחה יכול לפתוח אלבום, להוסיף מדיה לכל אלבום ולתקן שם.
--
-- ⚠️ `year` יורד כאן, וגם המדיניות שנשענה על `race_id`: אלבום של
-- חתונה לא שייך לשום מירוץ, ולכן "מנהל תורן של המירוץ" הפסיק להיות
-- מושג רלוונטי בגלריה. נשארו מי שהעלה ומנהל-על.
-- ─────────────────────────────────────────────────────────────

create table if not exists public.gallery_albums (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.gallery_albums
  drop constraint if exists gallery_albums_name_len;
alter table public.gallery_albums
  add constraint gallery_albums_name_len
  check (length(btrim(name)) between 1 and 60);

alter table public.gallery_albums enable row level security;

-- ─────────────────────────────────────────────────────────────
-- שיוך התמונות לאלבום
--
-- `on delete restrict` ולא `cascade`: מחיקת אלבום שיש בו תמונות הייתה
-- מוחקת עשרות תמונות של אנשים אחרים בלחיצה אחת. מי שרוצה להיפטר
-- מאלבום מרוקן אותו קודם — אותו עיקרון כמו מחיקת עלה בעץ (0010).
-- ─────────────────────────────────────────────────────────────

alter table public.gallery_photos
  add column if not exists album_id uuid
    references public.gallery_albums (id) on delete restrict;

-- שורות שקדמו לאלבומים (אם יש כאלה) — אלבום אחד לכל שנה שכבר בשימוש
do $$
declare
  v_year int;
  v_album uuid;
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'gallery_photos'
               and column_name = 'year') then
    for v_year in
      select distinct year from public.gallery_photos where album_id is null
    loop
      insert into public.gallery_albums (name) values (v_year::text)
        returning id into v_album;
      update public.gallery_photos
        set album_id = v_album
        where album_id is null and year = v_year;
    end loop;
  end if;
end $$;

alter table public.gallery_photos
  alter column album_id set not null;

create index if not exists gallery_photos_album_idx
  on public.gallery_photos (album_id, created_at desc);

-- ה-year והטריגר ששמר על עקביות מולו כבר לא קיימים כמושג
drop trigger if exists gallery_photos_sync_year on public.gallery_photos;
drop function if exists public.sync_gallery_photo_year();
alter table public.gallery_photos drop constraint if exists gallery_photos_year_valid;
alter table public.gallery_photos drop column if exists year;
drop index if exists public.gallery_photos_year_idx;

-- ─────────────────────────────────────────────────────────────
-- מדיניות האלבומים
--
-- האלבום שייך למשפחה ולא לפותח אותו — בדיוק כמו העץ המשפחתי (docs/06
-- §4): כל בן משפחה מוסיף אליו מדיה ומתקן את שמו. מה שכן נשמר לפותח
-- (ולמנהל-על) היא **המחיקה**, כי היא הפעולה היחידה שאי אפשר לתקן.
-- ─────────────────────────────────────────────────────────────

drop policy if exists gallery_albums_read on public.gallery_albums;
create policy gallery_albums_read on public.gallery_albums for select to authenticated
  using (true);

drop policy if exists gallery_albums_insert on public.gallery_albums;
create policy gallery_albums_insert on public.gallery_albums for insert to authenticated
  with check (created_by = (select auth.uid()));

drop policy if exists gallery_albums_update on public.gallery_albums;
create policy gallery_albums_update on public.gallery_albums for update to authenticated
  using (true) with check (true);

drop policy if exists gallery_albums_delete on public.gallery_albums;
create policy gallery_albums_delete on public.gallery_albums for delete to authenticated
  using (created_by = (select auth.uid()) or public.is_owner());

-- אותו טעם כמו ב-0012: RLS מחליט על אילו שורות מותר לכתוב, לא על אילו
-- עמודות. בלי זה "תיקון שם" היה יכול להיות גם החלפת `created_by`
revoke update on public.gallery_albums from authenticated;
grant update (name, updated_at) on public.gallery_albums to authenticated;

create or replace function public.touch_gallery_album()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists gallery_albums_touch on public.gallery_albums;
create trigger gallery_albums_touch
  before update on public.gallery_albums
  for each row execute function public.touch_gallery_album();

-- ─────────────────────────────────────────────────────────────
-- מדיניות התמונות — בלי מנהל תורן, בלי שנה
-- ─────────────────────────────────────────────────────────────

drop policy if exists gallery_update on public.gallery_photos;
create policy gallery_update on public.gallery_photos for update to authenticated
  using (uploaded_by = (select auth.uid()) or public.is_owner())
  with check (uploaded_by = (select auth.uid()) or public.is_owner());

drop policy if exists gallery_delete on public.gallery_photos;
create policy gallery_delete on public.gallery_photos for delete to authenticated
  using (uploaded_by = (select auth.uid()) or public.is_owner());

drop function if exists public.can_manage_gallery(uuid);

revoke update on public.gallery_photos from authenticated;
grant update (caption, album_id) on public.gallery_photos to authenticated;

-- ─────────────────────────────────────────────────────────────
-- ה-bucket: מדיה, לא רק תמונות
--
-- "להוסיף מדיה לאלבום" כולל סרטונים, ואלה לא עוברים את ההקטנה
-- שבדפדפן (היא לתמונות בלבד). 50MB — אותה תקרה כמו chat-files ב-0005,
-- ומאותה סיבה: היא נאכפת ב-Storage עצמו ולא רק במחבר.
-- ─────────────────────────────────────────────────────────────

do $$
begin
  if exists (select 1 from information_schema.tables
             where table_schema = 'storage' and table_name = 'objects') then
    update storage.buckets set file_size_limit = 52428800 where id = 'gallery';
  end if;
end $$;
