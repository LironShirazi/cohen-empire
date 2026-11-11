-- ─────────────────────────────────────────────────────────────
-- סטוריז משפחתיים (סבב 6 בסקיצות)
--
-- פס עיגולים בראש דף הבית. כל סטורי חי 24 שעות. תמונה (מוקטנת בטלפון
-- ל-1080px) או משפט על רקע צבעוני — האחרון לא שומר קובץ בכלל.
--
-- שם ותמונה **לא משוכפלים** בשורה: הם נלקחים מהעץ (`family_members`
-- עם `profile_id`) ואם אין — מפרופיל ה-Google.
-- ─────────────────────────────────────────────────────────────

create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind text not null,
  -- נתיב ב-bucket `stories` — רק לתמונה
  storage_path text,
  caption text,
  -- אינדקס לפלטת הרקעים של סטורי טקסט (`STORY_COLORS` בקליינט)
  color smallint,
  created_at timestamptz not null default now(),

  constraint stories_kind_valid check (kind in ('photo', 'text')),
  constraint stories_caption_len check (caption is null or length(btrim(caption)) between 1 and 80),
  constraint stories_shape check (
    (kind = 'photo' and storage_path is not null and color is null)
    or (kind = 'text' and storage_path is null and caption is not null
        and color between 0 and 15)
  )
);

create index if not exists stories_created_at_idx on public.stories (created_at desc);
create index if not exists stories_user_idx on public.stories (user_id, created_at);

alter table public.stories enable row level security;

-- ⚠️ הסינון של 24 השעות **במדיניות** ולא רק בשאילתה: סטורי שפג לא
-- מוחזר לאף אחד, גם לפני שהשורה שלו נמחקה בפועל
drop policy if exists stories_read on public.stories;
create policy stories_read on public.stories for select to authenticated
  using (created_at > now() - interval '24 hours');

drop policy if exists stories_insert on public.stories;
create policy stories_insert on public.stories for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists stories_delete on public.stories;
create policy stories_delete on public.stories for delete to authenticated
  using (user_id = (select auth.uid()) or public.is_owner());

revoke update on public.stories from authenticated;

-- ─────────────────────────────────────────────────────────────
-- מי צפה — שורה אחת לכל צופה. צפייה חוזרת לא מוסיפה שורה (מפתח ראשי),
-- ומזה נגזרת גם הטבעת הצבעונית/האפורה — בלי שדה נוסף.
-- ─────────────────────────────────────────────────────────────

create table if not exists public.story_views (
  story_id uuid not null references public.stories (id) on delete cascade,
  viewer_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (story_id, viewer_id)
);

create index if not exists story_views_viewer_idx on public.story_views (viewer_id);

alter table public.story_views enable row level security;

-- רשימת הצופים חוזרת **רק למי שהעלה**. כל אחד רואה גם את הצפיות של
-- עצמו — משם הטבעת יודעת מה כבר נצפה
drop policy if exists story_views_read on public.story_views;
create policy story_views_read on public.story_views for select to authenticated
  using (
    viewer_id = (select auth.uid())
    or exists (
      select 1 from public.stories s
      where s.id = story_id and s.user_id = (select auth.uid())
    )
  );

-- צפייה בסטורי של עצמך לא נרשמת — "צפו: 1" כשזה אתה מטעה
drop policy if exists story_views_insert on public.story_views;
create policy story_views_insert on public.story_views for insert to authenticated
  with check (
    viewer_id = (select auth.uid())
    and exists (
      select 1 from public.stories s
      where s.id = story_id and s.user_id <> (select auth.uid())
    )
  );

revoke update on public.story_views from authenticated;

-- ─────────────────────────────────────────────────────────────
-- מי שלא מחובר רואה *שיש* סטוריז (עיגולים מטושטשים) — לא מי ולא מה.
-- מספר בלבד, ולכן מותר גם ל-anon.
-- ─────────────────────────────────────────────────────────────

create or replace function public.count_active_story_users()
returns int
language sql
stable
security definer set search_path = ''
as $$
  select count(distinct user_id)::int
  from public.stories
  where created_at > now() - interval '24 hours';
$$;

grant execute on function public.count_active_story_users() to anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- ניקוי: מוחק את הסטוריז של הקורא שעברו 24 שעות ומחזיר את נתיבי
-- הקבצים, כדי שהקליינט ימחק אותם מה-bucket.
--
-- ⚠️ למה לא pg_cron כמו בסקיצה: מחיקת שורה מ-`storage.objects` ב-SQL
-- לא מוחקת את הקובץ עצמו — זה עובר רק דרך ה-Storage API. משימה
-- מתוזמנת שמוחקת את השורות הייתה משאירה את הקבצים יתומים לנצח, בלי
-- שום דרך לדעת איפה הם. כאן השורה נמחקת רק כשמי שיכול למחוק את הקובץ
-- (בעליו) מחזיק את הנתיב ביד. נקרא מדף הבית של המעלה.
--
-- `security definer` כי השורות האלה כבר לא עוברות את `stories_read`,
-- ו-DELETE לא רואה שורה שה-SELECT לא רואה.
-- ─────────────────────────────────────────────────────────────

create or replace function public.take_my_expired_stories()
returns setof text
language sql
security definer set search_path = ''
as $$
  delete from public.stories
  where user_id = (select auth.uid())
    and created_at <= now() - interval '24 hours'
  returning storage_path;
$$;

revoke execute on function public.take_my_expired_stories() from public, anon;
grant execute on function public.take_my_expired_stories() to authenticated;

-- ─────────────────────────────────────────────────────────────
-- Storage: bucket `stories`
--
-- 5MB — תמונה בודדת אחרי הקטנה ל-1080px היא 80–200KB. התיקייה היא
-- המזהה של המעלה, ורק הוא (ומנהל-על) מוחק ממנה.
-- ─────────────────────────────────────────────────────────────

do $$
begin
  if exists (select 1 from information_schema.tables
             where table_schema = 'storage' and table_name = 'objects') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('stories', 'stories', true, 5242880,
            array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'])
    on conflict (id) do update
      set public = excluded.public,
          file_size_limit = excluded.file_size_limit,
          allowed_mime_types = excluded.allowed_mime_types;

    drop policy if exists stories_files_read on storage.objects;
    create policy stories_files_read on storage.objects for select
      using (bucket_id = 'stories');

    drop policy if exists stories_files_insert on storage.objects;
    create policy stories_files_insert on storage.objects for insert to authenticated
      with check (
        bucket_id = 'stories'
        and (storage.foldername(name))[1] = (select auth.uid())::text
      );

    drop policy if exists stories_files_delete on storage.objects;
    create policy stories_files_delete on storage.objects for delete to authenticated
      using (
        bucket_id = 'stories'
        and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_owner())
      );
  end if;
end $$;
