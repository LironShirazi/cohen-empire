-- ─────────────────────────────────────────────────────────────
-- 0017 — שני תיקונים ב-0015 שנמצאו בסקירת קוד
-- ─────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────
-- 1. `has_finished_route` דלפה בדיוק את מה ש-0015 בא להסתיר
--
-- הפונקציה היא `security definer`, מקבלת `p_team_id` **שרירותי**,
-- לא בדקה שום הרשאה, והורשתה לכל `authenticated`. מכיוון ש-
-- `teams_read` הוא `using (true)` (0001), משתתף שעוד בשטח יכול היה
-- לשלוף את כל מזהי הקבוצות במירוץ ולקרוא לה אחת-אחת — וכך לדעת מי
-- כבר סיים את המסלול.
--
-- זו בדיוק העובדה ש-`get_race_results` ו-`winner_declared` ב-
-- `get_team_state` טורחות להסתיר: קבוצה שעוד רצה לא אמורה לדעת
-- שההכרעה נפלה (docs/02 §3.11). הדלת האחורית ביטלה את שתיהן.
--
-- הגדר עצמו לא משתנה — רק מי מורשה לשאול. כל הקוראים הקיימים
-- עוברים אותו: ב-`get_race_results` השאילתה כבר מסננת ב-
-- `is_team_member(t.id)`, ב-`get_team_state` ההרשאה נבדקה בראש
-- הפונקציה, וב-`lib/data.ts` הקריאה היא תמיד על הקבוצה של הקורא.
-- ─────────────────────────────────────────────────────────────
create or replace function public.has_finished_route(p_team_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (public.is_team_member(p_team_id)
          or public.is_team_race_admin(p_team_id)) then
    raise exception 'אין הרשאה לבדוק את מצב הקבוצה הזו';
  end if;

  return exists (select 1 from public.team_stations where team_id = p_team_id)
     and not exists (
       select 1
       from public.team_stations ts
       left join public.team_progress tp
         on tp.team_id = ts.team_id and tp.station_id = ts.station_id
       where ts.team_id = p_team_id and tp.completed_at is null
     );
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- 2. הכרזה מוקדמת הכתירה קבוצה אקראית — לצמיתות
--
-- `declare_winner` לקחה את מקום 1 מ-`get_leaderboard` בלי לדרוש
-- שמישהו בכלל סיים. כשאין עדיין השלמות, המיון
-- `done desc, last_done asc nulls last, name` מתמוטט ל-`name`,
-- כלומר **הקבוצה הראשונה לפי א״ב**.
--
-- ומכיוון שהפונקציה אידמפוטנטית ושומרת את התוצאה ב-
-- `races.winner_team_id`, לחיצה מוטעית עשר דקות אחרי הזינוק הייתה
-- מקבעת את הקבוצה הזו כמקום 1 ב-`get_race_results`, דורסת את שורת
-- היכל התהילה של השנה, ולא משאירה שום דרך באפליקציה לבטל.
--
-- עכשיו: אי אפשר להכריז לפני שקבוצה אחת לפחות סיימה את המסלול.
-- זה גם מה שהכפתור אומר ממילא — "לוחצים כשהקבוצה הראשונה חוזרת".
-- ─────────────────────────────────────────────────────────────
create or replace function public.declare_winner(p_race_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_race public.races;
  v_team public.teams;
  v_members jsonb;
begin
  if not public.is_race_admin(p_race_id) then
    raise exception 'אין הרשאה להכריז על זוכים במירוץ זה';
  end if;

  select * into v_race from public.races where id = p_race_id;
  if v_race.id is null then
    raise exception 'מירוץ לא נמצא';
  end if;

  if v_race.winner_team_id is not null then
    select * into v_team from public.teams where id = v_race.winner_team_id;
  else
    -- ⚠️ בלי התנאי הזה "מקום 1" הוא סתם הקבוצה הראשונה לפי א״ב
    if not exists (
      select 1 from public.teams t
      where t.race_id = p_race_id
        and exists (select 1 from public.team_stations where team_id = t.id)
        and not exists (
          select 1
          from public.team_stations ts
          left join public.team_progress tp
            on tp.team_id = ts.team_id and tp.station_id = ts.station_id
          where ts.team_id = t.id and tp.completed_at is null
        )
    ) then
      raise exception 'עוד לא סיימה אף קבוצה את המסלול — אין על מי להכריז';
    end if;

    select t.* into v_team
    from public.teams t
    join public.get_leaderboard(p_race_id) lb on lb.team_id = t.id
    where lb.rank = 1;

    if v_team.id is null then
      return jsonb_build_object('winner', null);
    end if;

    update public.races
       set winner_team_id = v_team.id,
           winner_declared_at = now()
     where id = p_race_id;
  end if;

  select coalesce(jsonb_agg(tm.display_name order by tm.display_name), '[]'::jsonb)
    into v_members
  from public.team_members tm where tm.team_id = v_team.id;

  -- ה-upsert לא נוגע ב-`photo_url` בכוונה (CLAUDE.md §11)
  insert into public.hall_of_fame (year, race_id, team_name, team_color, members)
  values (v_race.year, v_race.id, v_team.name, v_team.color, v_members)
  on conflict (year) do update
    set race_id = excluded.race_id,
        team_name = excluded.team_name,
        team_color = excluded.team_color,
        members = excluded.members;

  return jsonb_build_object(
    'winner', jsonb_build_object(
      'team_id', v_team.id,
      'name', v_team.name,
      'color', v_team.color,
      'animal', v_team.animal,
      'members', v_members
    )
  );
end;
$$;
