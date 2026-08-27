-- ─────────────────────────────────────────────────────────────
-- מנהל-על הוא גם מנהל תורן של כל מירוץ
-- מקור: docs/01 §2 (התפקידים) — מנהל-על הוא "מעל" המנהל התורן
--
-- עד כאן שני התפקידים היו **מנותקים**: `is_owner()` פתח את התוכן
-- המשפחתי ואת יצירת המירוץ, ו-`is_race_admin()` פתח את ניהול המירוץ
-- עצמו — ומנהל-על שלא מינה את עצמו לתורן לא יכול היה לפתוח את לוח
-- הבקרה, לאשר משימה או לשלוח הודעת רוחב. זה לא היה שיקול מוצר אלא
-- מה שיצא: `create_race` (0002) ממנה את היוצר לתורן, ולכן מנהל-על
-- שיצר את המירוץ *כן* ראה אותו, ובמירוץ שיצר מישהו אחר — לא.
--
-- **הכלל מכאן: כל מה שמותר למנהל תורן מותר גם למנהל-על.** במקום
-- לפזר `or public.is_owner()` בעשרות מדיניות ופונקציות, הוא נכנס
-- לשלוש פונקציות העזר שכולן כבר נשענות עליהן.
--
-- ⚠️ **הארכוב עדיין חוסם.** `is_race_admin` מחזיר false על מירוץ
-- בארכיון (0002) — "אחרי זה אין יותר עריכה לאיש" — וזה נשאר נכון
-- גם למנהל-על. הארכוב הוא נעילה של המירוץ, לא של התפקיד.
-- ─────────────────────────────────────────────────────────────

-- מנהל תורן של המירוץ, או מנהל-על — כל עוד המירוץ אינו בארכיון.
-- ה-left join מחזיק את בדיקת הארכוב במקום אחד לשני המקרים.
create or replace function public.is_race_admin(p_race_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.races r
    left join public.race_admins ra
      on ra.race_id = r.id
     and ra.user_id = (select auth.uid())
    where r.id = p_race_id
      and r.status <> 'archived'
      and (ra.user_id is not null or public.is_owner())
  );
$$;

-- אותו כלל, דרך הקבוצה (הצ'אט ואישורי המשימות נשענים עליו)
create or replace function public.is_team_race_admin(p_team_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.teams t
    join public.races r on r.id = t.race_id
    left join public.race_admins ra
      on ra.race_id = t.race_id
     and ra.user_id = (select auth.uid())
    where t.id = p_team_id
      and r.status <> 'archived'
      and (ra.user_id is not null or public.is_owner())
  );
$$;

-- קריאת צ'אט — כאן דווקא **כן** גם בארכיון, בדיוק כמו למנהל התורן
-- (0005: ההיסטוריה נשארת פתוחה לקריאה, docs/02 §3.4)
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
  ) or public.is_owner();
$$;

-- ─────────────────────────────────────────────────────────────
-- אזכורים — מנהל-על הוא נמען חוקי בכל צ'אט
--
-- הטריגר (0006) יוצר התראה רק למי שבאמת בצ'אט הזה: חבר קבוצה או
-- מנהל תורן. עכשיו שמנהל-על רשאי לקרוא ולכתוב בכל צ'אט, הבורר
-- בממשק מציע אותו — ובלי השורה הזו האזכור שלו היה נכתב בהודעה
-- בלי שתישלח לו התראה.
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
      or exists (
        select 1 from public.profiles p
        where p.id = m.user_id
          and p.is_owner
      )
    );

  return new;
end;
$$;
