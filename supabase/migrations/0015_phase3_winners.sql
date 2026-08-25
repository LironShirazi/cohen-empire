-- ─────────────────────────────────────────────────────────────
-- שלב 3 — מסך הזוכים החגיגי (סקיצה 2h, docs/01 §6)
--
-- מה היה חסר: `finish_race` (0002) כבר בחר זוכה, כתב אותו להיכל
-- התהילה והחזיר אותו — אבל **רק למי שלחץ על הכפתור**. ההכרזה חיה
-- ב-state מקומי במסך הניהול ונעלמה ברענון, ולמשתתפים לא היה מסך בכלל.
--
-- ⚠️ **ההחלטה המרכזית כאן: הכרזת זוכים ≠ סיום מירוץ** (docs/02 §3.11).
-- עד עכשיו זו הייתה פעולה אחת, ולכן הרגע שבו הקבוצה הראשונה חוזרת
-- לבית סבא **נעל את כל מי שעוד בשטח**: גם `arrive_at_station` (0002)
-- וגם `complete_station` (0003) דורשים `status = 'live'`, וקבוצה שהייתה
-- באמצע הדרך קיבלה "המירוץ לא פעיל" ונשארה בלי סיום. במשפחה שרצה
-- 20 שנה זה בדיוק ההפך ממה שצריך לקרות: מי שעוד בחוץ צריך **לסיים
-- את המסלול שלו**, ובלי לדעת שכבר יש זוכה.
--
-- לכן שתי פעולות נפרדות:
--   `declare_winner` — יש אלופים, הם נכנסים להיכל התהילה, **המירוץ
--                      ממשיך לרוץ** לכל השאר.
--   `finish_race`    — סוגר את המירוץ, כשכולם כבר חזרו.
-- ─────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────
-- 1. הזוכה נשמר על המירוץ ולא מחושב מחדש
--
-- ⚠️ **חובה לשמור אותו.** אחרי ההכרזה קבוצות אחרות ממשיכות להשלים
-- משימות, ולכן חישוב מחדש של "מקום 1" יכול להחזיר קבוצה אחרת חצי
-- שעה אחר כך. האלופים הם מי שחזר ראשון ברגע ההכרזה — לא מי שצבר
-- הכי הרבה נקודות בסוף. זו גם השורה שכבר נכתבה להיכל התהילה.
-- ─────────────────────────────────────────────────────────────
alter table public.races
  add column if not exists winner_team_id uuid references public.teams (id) on delete set null,
  add column if not exists winner_declared_at timestamptz;

-- ─────────────────────────────────────────────────────────────
-- 2. "הקבוצה הזו סיימה את המסלול שלה"
--
-- אותה הגדרה בדיוק שממנה `get_team_state` מסיק `state = 'finished'`:
-- יש לה תחנות, ולא נשארה אף אחת בלי `completed_at`. זה התנאי שקובע
-- מי רשאי לראות תוצאות בזמן שהמירוץ עוד רץ (§4).
-- ─────────────────────────────────────────────────────────────
create or replace function public.has_finished_route(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.team_stations where team_id = p_team_id)
     and not exists (
       select 1
       from public.team_stations ts
       left join public.team_progress tp
         on tp.team_id = ts.team_id and tp.station_id = ts.station_id
       where ts.team_id = p_team_id and tp.completed_at is null
     );
$$;

-- ─────────────────────────────────────────────────────────────
-- 3. הכרזת הזוכים — בלי לסגור את המירוץ
--
-- מה שהיה בתוך `finish_race` עד היום, מינוס `update races set status`.
-- אידמפוטנטי: הכרזה חוזרת מחזירה את אותם אלופים ולא בוחרת חדשים,
-- אחרת לחיצה כפולה הייתה מחליפה את הזוכים אחרי שקבוצה אחרת השלימה
-- עוד משימה.
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

-- ─────────────────────────────────────────────────────────────
-- 4. סיום המירוץ — עכשיו רק הסגירה
--
-- מי שלוחץ "סיום" בלי שהכריז קודם מקבל את שתי הפעולות יחד, כמו
-- שהיה תמיד. מהרגע הזה `arrive_at_station`/`complete_station` נועלים,
-- וזו בדיוק הסיבה שהכפתור הזה כבר לא הוא זה שמכריז.
-- ─────────────────────────────────────────────────────────────
create or replace function public.finish_race(p_race_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if not public.is_race_admin(p_race_id) then
    raise exception 'אין הרשאה לסיים מירוץ זה';
  end if;

  v_result := public.declare_winner(p_race_id);

  update public.races set status = 'finished' where id = p_race_id;

  return v_result;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- 5. התוצאות המלאות
--
-- ⚠️ **זו הפרה מכוונת ומגודרת של docs/02 §3.3.** הלידרבורד מחזיר
-- דירוג בלבד — בלי ספירת משימות ובלי זמנים — כדי לשמור על המתח.
-- הכלל הזה מגן על מי ש**עדיין רץ**. לכן הגדר כאן הוא לפי הקורא:
--
--   • מנהל תורן — תמיד;
--   • כולם — אחרי שהמירוץ נסגר (`finished`/`archived`);
--   • קבוצה שסיימה את המסלול שלה — מרגע שהוכרזו אלופים.
--
-- קבוצה שעוד בשטח מקבלת שגיאה, גם אם כבר יש אלופים. היא לא אמורה
-- לדעת שההכרעה נפלה — היא אמורה לסיים את המסלול שלה.
--
-- `security definer` הכרחי ממילא: `team_progress_read` (0002) נותן
-- למשתתף לראות רק את שורות הקבוצה שלו.
--
-- הדירוג זהה ל-`get_leaderboard` (done desc, last_done asc, name),
-- **חוץ מהאלופים שמוצמדים למקום 1** — הם מי שחזר ראשון, ולא מי
-- שהמשיך לצבור משימות אחרי ההכרזה (§1).
-- ─────────────────────────────────────────────────────────────
create or replace function public.get_race_results(p_race_id uuid)
returns table (
  rank int,
  team_id uuid,
  team_name text,
  team_color text,
  team_animal text,
  stations_done int,
  finished_at timestamptz,
  members jsonb
)
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_race public.races;
begin
  select * into v_race from public.races where id = p_race_id;

  if v_race.id is null then
    raise exception 'מירוץ לא נמצא';
  end if;

  if not (
    public.is_race_admin(p_race_id)
    or v_race.status in ('finished', 'archived')
    or (
      v_race.winner_declared_at is not null
      and exists (
        select 1 from public.teams t
        where t.race_id = p_race_id
          and public.is_team_member(t.id)
          and public.has_finished_route(t.id)
      )
    )
  ) then
    raise exception 'התוצאות המלאות נחשפות רק אחרי שסיימתם את המסלול';
  end if;

  return query
  -- שמות העמודות כאן מכוונים להיות שונים משמות ה-OUT (t_name ולא
  -- name, mates ולא members): ב-plpgsql פרמטר יוצא הוא משתנה, וכל
  -- התנגשות שם הופכת את ההפניה בשאילתה למעורפלת
  with scored as (
    select t.id            as t_id,
           t.name          as t_name,
           t.color         as t_color,
           t.animal        as t_animal,
           count(tp.completed_at) as done,
           max(tp.completed_at)   as last_done,
           (select coalesce(jsonb_agg(m.display_name order by m.display_name), '[]'::jsonb)
              from public.team_members m
             where m.team_id = t.id) as mates
    from public.teams t
    left join public.team_progress tp
      on tp.team_id = t.id and tp.completed_at is not null
    where t.race_id = p_race_id
    group by t.id, t.name, t.color, t.animal
  )
  select (row_number() over (
            order by coalesce(t_id = v_race.winner_team_id, false) desc,
                     done desc, last_done asc nulls last, t_name))::int,
         t_id, t_name, t_color, t_animal, done::int, last_done, mates
  from scored
  -- אותו סדר כמו ה-row_number. בלי ORDER BY מפורש סדר השורות
  -- החוזרות אינו מובטח, והמסך בונה את הפודיום לפי הסדר שקיבל
  order by coalesce(t_id = v_race.winner_team_id, false) desc,
           done desc, last_done asc nulls last, t_name;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- 6. get_team_state — מוסיף `winner_declared`
--
-- זהה ל-0002 חוץ מהשדה הזה. הוא מה שמאפשר למסך המשחק להחליט אם
-- להציע קישור לזוכים — **רק לקבוצה שכבר סיימה**. קבוצה שעוד רצה
-- מקבלת `false`, וממשיכה לראות רמז ומד מרחק כרגיל.
-- ─────────────────────────────────────────────────────────────
create or replace function public.get_team_state(p_team_id uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_is_admin boolean := public.is_team_race_admin(p_team_id);
  v_team public.teams;
  v_race public.races;
  v_station public.stations;
  v_station_id uuid;
  v_position int;
  v_progress public.team_progress;
  v_arrived boolean;
  v_state text;
  v_race_json jsonb;
begin
  if not (public.is_team_member(p_team_id) or v_is_admin) then
    raise exception 'אין הרשאה לצפות בקבוצה זו';
  end if;

  select * into v_team from public.teams where id = p_team_id;
  select * into v_race from public.races where id = v_team.race_id;

  -- ⚠️ `winner_declared` מסונן לפי אותו כלל כמו התוצאות עצמן (§5):
  -- קבוצה שעדיין בשטח מקבלת `false` **גם כשכבר יש אלופים**. אחרת
  -- השדה הזה היה מדליף לקליינט בדיוק את מה שהמסך לא אמור להראות,
  -- וכל מי שפותח DevTools היה יודע שההכרעה נפלה.
  v_race_json := jsonb_build_object(
    'id', v_race.id,
    'name', v_race.name,
    'status', v_race.status,
    'winner_declared',
      v_race.winner_declared_at is not null
      and (v_race.status <> 'live' or public.has_finished_route(p_team_id))
  );

  select ts.station_id, ts.position into v_station_id, v_position
  from public.team_stations ts
  left join public.team_progress tp
    on tp.team_id = ts.team_id and tp.station_id = ts.station_id
  where ts.team_id = p_team_id and tp.completed_at is null
  order by ts.position
  limit 1;

  if v_station_id is null then
    return jsonb_build_object(
      'team', jsonb_build_object('id', v_team.id, 'name', v_team.name,
                                 'color', v_team.color, 'animal', v_team.animal),
      'race', v_race_json,
      'state', case when exists (select 1 from public.team_stations where team_id = p_team_id)
                    then 'finished' else 'no_stations' end,
      'station', null
    );
  end if;

  select * into v_station from public.stations where id = v_station_id;

  select * into v_progress from public.team_progress
  where team_id = p_team_id and station_id = v_station_id;

  v_arrived := v_progress.arrived_at is not null;
  v_state := case
    when not v_arrived then 'clue'
    when v_progress.approval_requested_at is not null then 'awaiting_approval'
    else 'task'
  end;

  return jsonb_build_object(
    'team', jsonb_build_object('id', v_team.id, 'name', v_team.name,
                               'color', v_team.color, 'animal', v_team.animal),
    'race', v_race_json,
    'state', v_state,
    'station', jsonb_build_object(
      'id', v_station.id,
      'position', v_position,
      'clue', v_station.clue,
      'lat', v_station.lat,
      'lng', v_station.lng,
      'radius_m', v_station.radius_m,
      'completion_type', v_station.completion_type,
      -- נחשף רק אחרי אימות הגעה בשרת
      'name', case when v_arrived then v_station.name end,
      'backstory', case when v_arrived then v_station.backstory end,
      'task_content', case when v_arrived then v_station.task_content end
    ),
    'proof_url', v_progress.proof_url
  );
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- 7. הרשאות הרצה
-- ─────────────────────────────────────────────────────────────
revoke execute on function
  public.has_finished_route(uuid),
  public.declare_winner(uuid),
  public.get_race_results(uuid)
from public, anon;

grant execute on function
  public.has_finished_route(uuid),
  public.declare_winner(uuid),
  public.get_race_results(uuid)
to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 8. Realtime על `races` — הרגע שבו מסך הזוכים נדלק
--
-- הקליינט (`WinnerWatcher`) מנוי על UPDATE של המירוץ שלו. הוא מקפיץ
-- ל-/winners **רק** את מי שסיים את המסלול, או את כולם כשהמירוץ נסגר
-- סופית. קבוצה שעוד רצה לא זזה מהמסך שלה.
--
-- `races_read` (0001) הוא `using (true)` למשתמש מחובר, כך שהערוץ לא
-- חושף שורה שממילא לא הייתה נקראת דרך PostgREST.
-- ─────────────────────────────────────────────────────────────
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'races'
     )
  then
    alter publication supabase_realtime add table public.races;
  end if;
end $$;
