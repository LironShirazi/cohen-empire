-- ─────────────────────────────────────────────────────────────
-- שלב 2 — אזכורים (@) והתראות In-App
-- מקור: docs/01 §5.1, docs/02 §3.8, docs/04 §3
--
-- הטבלה `notifications` והטריגר `handle_message_mentions` נוצרו כבר
-- ב-0001. כאן משלימים את שני הדברים שחסרו כדי שהפיצ'ר יעבוד בפועל:
--
--   1. הקשחת הטריגר — הוא האמין לכל מה שהקליינט שם ב-
--      `mentioned_user_ids`, כלומר אפשר היה לשלוח התראה לכל משתמש
--      במערכת (גם למי שלא בצ'אט הזה בכלל) בקריאת API ישירה.
--   2. הוספת `notifications` ל-publication של Realtime — בלעדיה
--      הבאנר הקופץ לא היה נדלק עד רענון דף.
--
-- ההתראה נשארת נוצרת בשרת בלבד (docs/02 §3.8): אין ולא יהיה INSERT
-- מהקליינט על `notifications`.
-- ─────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────
-- הטריגר — מאזכרים רק את מי שבאמת בצ'אט הזה
--
-- אותה רשימה בדיוק שהבורר בממשק מציע: חברי הקבוצה + המנהלים התורנים
-- של המירוץ. `distinct` כי אותו מזהה יכול להופיע פעמיים במערך שהגיע
-- מהקליינט, ואז היו נוצרות שתי התראות לאותה הודעה.
-- ─────────────────────────────────────────────────────────────
create or replace function public.handle_message_mentions()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_race_id uuid;
begin
  select race_id into v_race_id from public.teams where id = new.team_id;

  insert into public.notifications (user_id, type, race_id, team_id, message_id)
  select distinct m.user_id,
         'mention'::public.notification_type,
         v_race_id,
         new.team_id,
         new.id
  from unnest(new.mentioned_user_ids) as m(user_id)
  where m.user_id <> new.sender_id
    and (
      exists (
        select 1 from public.team_members tm
        where tm.team_id = new.team_id
          and tm.user_id = m.user_id
      )
      or exists (
        select 1 from public.race_admins ra
        where ra.race_id = v_race_id
          and ra.user_id = m.user_id
      )
    );

  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- Realtime — הקליינט מנוי על INSERT ב-notifications מסונן לפי
-- `user_id` שלו (docs/02 §3.8). ה-RLS `notifications_read_self`
-- מ-0001 חל גם על הערוץ, אז מנוי למזהה של מישהו אחר לא יקבל שורות.
-- ─────────────────────────────────────────────────────────────
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'notifications'
     )
  then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────
-- הבאדג' שואל "מה לא נקרא בקבוצה הזו" — האינדקס מ-0001 הוא על
-- user_id בלבד, וכאן מוסיפים את team_id כדי שהשאילתה של מסך
-- הקבוצה ושל רשימת הצ'אטים של המנהל תישאר נקודתית.
-- ─────────────────────────────────────────────────────────────
create index if not exists notifications_unread_team_idx
  on public.notifications (user_id, team_id)
  where read_at is null;
