-- ─────────────────────────────────────────────────────────────
-- 0016 — מתג מד המרחק
--
-- הסקיצות מגדירות `showDistance` כ-tweak של המנהל (ברירת מחדל:
-- דלוק). באפליקציה המד תמיד הוצג. עם המתג כבוי המשימה הופכת לחיפוש
-- אמיתי: יש רמז, אין חץ.
--
-- ⚠️⚠️ **המתג נאכף בשרת ולא במסך.** אם `get_team_state` היה ממשיך
-- להחזיר `lat`/`lng` של התחנה והקליינט רק היה מסתיר את המספר, כל מי
-- שפותח DevTools היה מקבל את הקואורדינטות המדויקות — כלומר בדיוק את
-- מה שהמנהל ניסה להסתיר, ועוד בדיוק רב יותר ממד המרחק עצמו.
-- לכן כשהמתג כבוי הפונקציה מחזירה `null` בשדות האלה.
--
-- זה **לא** משנה את אימות ההגעה: `arrive_at_station` (0002) ממשיך
-- למדוד Haversine בשרת מול הקואורדינטות שהמכשיר שלח, ולא נשען על
-- שום דבר שהקליינט יודע (docs/02 §3.1).
-- ─────────────────────────────────────────────────────────────

alter table public.races
  add column if not exists show_distance boolean not null default true;

comment on column public.races.show_distance is
  'האם להציג לקבוצות מד מרחק חי לתחנה. כבוי = יש רמז, אין חץ.';

-- ─────────────────────────────────────────────────────────────
-- שינוי המתג — RPC ולא UPDATE ישיר
--
-- ככל שאר שינויי מצב המשחק (CLAUDE.md §5): בדיקת ההרשאה יושבת בתוך
-- הפונקציה, ולא נסמכת על כך שה-RLS של `races` יגן על העמודה הזו.
-- ─────────────────────────────────────────────────────────────
create or replace function public.set_race_show_distance(
  p_race_id uuid,
  p_value boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_race_admin(p_race_id) then
    raise exception 'רק מנהל תורן של המירוץ יכול לשנות את מד המרחק';
  end if;

  update public.races set show_distance = p_value where id = p_race_id;
end;
$$;

revoke execute on function public.set_race_show_distance(uuid, boolean)
  from public, anon;
grant execute on function public.set_race_show_distance(uuid, boolean)
  to authenticated;

-- ─────────────────────────────────────────────────────────────
-- get_team_state — מוסיף `show_distance` ומעלים את הקואורדינטות
-- כשהוא כבוי. שאר הפונקציה זהה ל-0015.
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
  v_show_distance boolean;
begin
  if not (public.is_team_member(p_team_id) or v_is_admin) then
    raise exception 'אין הרשאה לצפות בקבוצה זו';
  end if;

  select * into v_team from public.teams where id = p_team_id;
  select * into v_race from public.races where id = v_team.race_id;

  -- המנהל התורן רואה תמיד את הקואורדינטות: הוא זה שפותח משימה ידנית
  -- כשה-GPS מתעקש, ובלי המיקום הוא לא יכול לעשות את זה
  v_show_distance := v_race.show_distance or v_is_admin;

  -- ⚠️ `winner_declared` מסונן לפי אותו כלל כמו התוצאות עצמן:
  -- קבוצה שעדיין בשטח מקבלת `false` **גם כשכבר יש אלופים**. אחרת
  -- השדה הזה היה מדליף לקליינט בדיוק את מה שהמסך לא אמור להראות,
  -- וכל מי שפותח DevTools היה יודע שההכרעה נפלה.
  v_race_json := jsonb_build_object(
    'id', v_race.id,
    'name', v_race.name,
    'status', v_race.status,
    'show_distance', v_show_distance,
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
      -- ⚠️ הקואורדינטות נעלמות כשהמתג כבוי. אחרי ההגעה הן כבר לא
      -- סוד — הקבוצה עומדת שם — ולכן חוזרות, כדי שלא נשבור שום
      -- מסך שמציג את התחנה אחרי פתיחתה.
      'lat', case when v_show_distance or v_arrived then v_station.lat end,
      'lng', case when v_show_distance or v_arrived then v_station.lng end,
      'radius_m', case when v_show_distance or v_arrived then v_station.radius_m end,
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
