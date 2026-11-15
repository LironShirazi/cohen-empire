-- ─────────────────────────────────────────────────────────────
-- הרכב הקבוצה: הוצאת משתתף רשום, וביטול בקשת הצטרפות ע"י המבקש
--
-- 0009 הגביל את המחיקה הישירה מ-`team_members` לשורות ידניות בכוונה:
-- מחיקת חבר *רשום* הייתה משאירה מאחור `join_requests` מאושרת, ו-
-- `join_race` (0002) מחזירה בקשה מאושרת כמו שהיא בלי לאפשר בקשה חדשה —
-- המשתתף היה נשאר תקוע. זה הפיצ'ר ש-0009 דחה, ושתי הפונקציות כאן
-- מטפלות בשורה ובבקשה יחד, בטרנזקציה אחת.
--
--   1. `admin_remove_member` — מנהל תורן ומנהל-על (`is_team_race_admin`,
--      שמאז 0018 כולל את מנהל-העל וחוסם מירוץ בארכיון). למשתתף רשום
--      נמחקת גם הבקשה שלו במירוץ הזה, והוא חוזר בדיוק למצב של מי
--      שמעולם לא ביקש: אין לו קבוצה, אין לו בקשה, ו-`join_race` פתוחה
--      לו מחדש. ההודעות שכתב בצ'אט נשארות (אין מחיקת הודעות, §7),
--      וההתקדמות שייכת לקבוצה ולא לו — אין מה לנקות שם.
--   2. `cancel_join_request` — המבקש בלבד, ורק בקשה **ממתינה**: מי
--      שהזין קוד קבוצה שגוי יוצא ממסך ההמתנה בלי לחכות שהמנהל ידחה.
--      בקשה שכבר אושרה היא חברות בקבוצה, והוצאה ממנה היא החלטת מנהל.
-- ─────────────────────────────────────────────────────────────

create or replace function public.admin_remove_member(p_member_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.team_members;
  v_race_id uuid;
begin
  select * into v_member from public.team_members where id = p_member_id;
  if v_member.id is null then
    raise exception 'המשתתף לא נמצא';
  end if;
  if not public.is_team_race_admin(v_member.team_id) then
    raise exception 'אין הרשאה לערוך את הרכב הקבוצה';
  end if;

  delete from public.team_members where id = p_member_id;

  if v_member.user_id is not null then
    select race_id into v_race_id from public.teams where id = v_member.team_id;
    delete from public.join_requests
    where race_id = v_race_id and user_id = v_member.user_id;
  end if;
end;
$$;

create or replace function public.cancel_join_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.join_requests
  where id = p_request_id
    and user_id = (select auth.uid())
    and status = 'pending';
  if not found then
    raise exception 'אין בקשה ממתינה לביטול';
  end if;
end;
$$;

revoke execute on function
  public.admin_remove_member(uuid),
  public.cancel_join_request(uuid)
  from public, anon;

grant execute on function
  public.admin_remove_member(uuid),
  public.cancel_join_request(uuid)
  to authenticated;
