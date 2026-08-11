-- ─────────────────────────────────────────────────────────────
-- שלב 2 — צ'אט קבוצתי בזמן אמת
-- מקור: docs/01 §5, docs/02 §3.7, docs/03 (`messages`), docs/04 §3
--
-- הטבלה `messages` נוצרה כבר ב-0001 יחד עם RLS מופעל — אבל בלי אף
-- מדיניות, כלומר סגורה לחלוטין. כאן פותחים אותה בדיוק למי שצריך:
-- חברי הקבוצה המאושרים + המנהל התורן של המירוץ (docs/02 §3.4, §3.7).
--
-- שלא כמו מצב המשחק, צ'אט אינו עובר דרך RPC: אין כאן מה לאמת מעבר
-- לזהות השולח וחברות בקבוצה, ושתיהן נאכפות ב-RLS. `mentioned_user_ids`
-- כבר קיים בטבלה והטריגר מ-0001 יוצר ממנו התראות — בורר ה-@ עצמו
-- מגיע בהמשך שלב 2.
-- ─────────────────────────────────────────────────────────────

-- הודעה חייבת להגיד משהו: טקסט או קובץ (או שניהם)
alter table public.messages
  drop constraint if exists messages_not_empty;

alter table public.messages
  add constraint messages_not_empty check (
    coalesce(body, '') <> '' or attachment_url is not null
  );

-- הצ'אט נטען תמיד כ"קבוצה אחת לפי זמן"
create index if not exists messages_team_created_idx
  on public.messages (team_id, created_at);

-- ─────────────────────────────────────────────────────────────
-- מי בצ'אט של הקבוצה
--
-- קריאה מותרת גם במירוץ מארכיון (ההיסטוריה נשארת פתוחה לקריאה —
-- docs/02 §3.4), ולכן היא לא משתמשת ב-is_race_admin שחוסם ארכיון.
-- כתיבה — רק כל עוד המירוץ חי.
-- ─────────────────────────────────────────────────────────────
create or replace function public.can_read_team_chat(p_team_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.team_members tm
    where tm.team_id = p_team_id
      and tm.user_id = (select auth.uid())
  ) or exists (
    select 1
    from public.teams t
    join public.race_admins ra on ra.race_id = t.race_id
    where t.id = p_team_id
      and ra.user_id = (select auth.uid())
  );
$$;

create or replace function public.can_post_team_chat(p_team_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select public.is_team_member(p_team_id) or public.is_team_race_admin(p_team_id);
$$;

-- ─────────────────────────────────────────────────────────────
-- RLS
--
-- אין מדיניות UPDATE/DELETE בכוונה: הודעה שנשלחה נשארת. בקבוצה
-- משפחתית של 40 איש עדיף שלא יהיה "מי מחק לי את ההודעה" באמצע מירוץ.
-- ─────────────────────────────────────────────────────────────
drop policy if exists messages_read on public.messages;
create policy messages_read on public.messages for select to authenticated
  using (public.can_read_team_chat(team_id));

drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and public.can_post_team_chat(team_id)
  );

-- ─────────────────────────────────────────────────────────────
-- Realtime — הקליינט מנוי על INSERT מסונן לפי team_id (docs/02 §3.7).
-- ה-RLS למעלה חל גם על ההודעות שנשלחות בערוץ, אז מנוי לקבוצה זרה
-- פשוט לא יקבל שורות.
-- ─────────────────────────────────────────────────────────────
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'messages'
     )
  then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────
-- Storage — קבצי הצ'אט ("קבצים מכל סוג", docs/01 §5).
-- אותה גישה כמו station-media ו-proofs: הקובץ קריא למי שיש לו
-- הקישור, והקישור עצמו מגיע רק דרך הודעה שה-RLS למעלה חושף.
-- התיקייה היא מזהה הקבוצה — כך ההעלאה נאכפת מול אותה בדיקת הרשאה
-- כמו שליחת ההודעה.
-- ─────────────────────────────────────────────────────────────
do $$
begin
  if exists (select 1 from information_schema.tables
             where table_schema = 'storage' and table_name = 'objects') then

    -- תקרת הגודל נאכפת ב-Storage עצמו ולא רק בקליינט: בלעדיה אפשר
    -- לעקוף את הבדיקה שבמחבר בקריאת API ישירה ולמלא את ה-bucket
    insert into storage.buckets (id, name, public, file_size_limit)
    values ('chat-files', 'chat-files', true, 52428800)
    on conflict (id) do update
      set public = excluded.public,
          file_size_limit = excluded.file_size_limit;

    drop policy if exists chat_files_read on storage.objects;
    create policy chat_files_read on storage.objects for select
      using (bucket_id = 'chat-files');

    drop policy if exists chat_files_insert on storage.objects;
    create policy chat_files_insert on storage.objects for insert to authenticated
      with check (
        bucket_id = 'chat-files'
        and public.can_post_team_chat(((storage.foldername(name))[1])::uuid)
      );

    drop policy if exists chat_files_delete on storage.objects;
    create policy chat_files_delete on storage.objects for delete to authenticated
      using (
        bucket_id = 'chat-files'
        and public.is_team_race_admin(((storage.foldername(name))[1])::uuid)
      );
  end if;
end $$;
