-- ─────────────────────────────────────────────────────────────
-- שלב 2 — הודעת רוחב מהמנהל התורן
-- מקור: docs/01 §4 ("שליחת הודעות"), docs/04 §4 ("שליחת הודעה לכל
-- הקבוצות או לקבוצה ספציפית"), docs/05 שלב 2
--
-- **הודעת רוחב היא הודעת צ'אט, לא ישות חדשה.** היא נכנסת לצ'אט של כל
-- קבוצת יעד כהודעה רגילה מהמנהל (הצ'אט כבר מסמן אותה 📣) ומייצרת
-- התראת `admin_broadcast` לכל חבר קבוצה. למה כך:
--   · ההודעה נשמרת בהקשר שבו קוראים אותה — docs/02 §3.8 קבע במפורש
--     שאין מרכז התראות נפרד, הצ'אט הוא ההקשר
--   · Realtime, ההרשאות, הקבצים והתצוגה כבר קיימים ועובדים
--   · מה שנשלח נשאר, כמו כל הודעה אחרת (אין UPDATE/DELETE ב-0005)
--
-- **למה RPC ולא כתיבה מהקליינט,** בניגוד לשאר הצ'אט: הפעולה כותבת
-- שורות `notifications` עבור **משתמשים אחרים**, ועל הטבלה הזו אין
-- ולא תהיה מדיניות INSERT מהקליינט (docs/02 §3.8). ההרשאה נבדקת
-- כאן בפנים, כמו בכל פונקציית מצב משחק.
-- ─────────────────────────────────────────────────────────────

create or replace function public.admin_broadcast(
  p_race_id uuid,
  p_body text,
  p_team_id uuid default null   -- null = כל הקבוצות במירוץ
)
returns int                     -- לכמה קבוצות נשלח
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sender uuid := (select auth.uid());
  v_body text := btrim(coalesce(p_body, ''));
  v_team uuid;
  v_message uuid;
  v_teams int := 0;
begin
  -- is_race_admin חוסם גם מירוץ בארכיון — שם הצ'אט פתוח לקריאה בלבד
  if not public.is_race_admin(p_race_id) then
    raise exception 'אין הרשאה לשלוח הודעה במירוץ הזה';
  end if;

  if v_body = '' then
    raise exception 'ההודעה ריקה';
  end if;

  -- קבוצה מפורשת חייבת להיות של המירוץ הזה, אחרת מנהל של מירוץ אחד
  -- היה שולח לצ'אט של מירוץ אחר
  if p_team_id is not null and not exists (
    select 1 from public.teams
    where id = p_team_id and race_id = p_race_id
  ) then
    raise exception 'הקבוצה לא שייכת למירוץ הזה';
  end if;

  -- הודעה אחת לכל קבוצת יעד, והתראה לכל חבר קבוצה רשום.
  -- משתתף ידני (`user_id is null`) מדולג — אין למי לשלוח התראה;
  -- הוא יראה את ההודעה בצ'אט של הקבוצה כמו כולם.
  for v_team in
    select id
    from public.teams
    where race_id = p_race_id
      and (p_team_id is null or id = p_team_id)
    order by join_code
  loop
    insert into public.messages (team_id, sender_id, body)
    values (v_team, v_sender, v_body)
    returning id into v_message;

    insert into public.notifications (user_id, type, race_id, team_id, message_id)
    select distinct
           tm.user_id,
           'admin_broadcast'::public.notification_type,
           p_race_id,
           v_team,
           v_message
    from public.team_members tm
    where tm.team_id = v_team
      and tm.user_id is not null
      and tm.user_id <> v_sender;

    v_teams := v_teams + 1;
  end loop;

  if v_teams = 0 then
    raise exception 'אין קבוצות לשלוח אליהן';
  end if;

  return v_teams;
end;
$$;

-- הרשאות הרצה: רק משתמש מחובר, כמו כל פונקציות המשחק (0002)
revoke execute on function public.admin_broadcast(uuid, text, uuid)
  from public, anon;
grant execute on function public.admin_broadcast(uuid, text, uuid)
  to authenticated;
