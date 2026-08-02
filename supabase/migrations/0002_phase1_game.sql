-- ─────────────────────────────────────────────────────────────
-- שלב 1 — MVP: אפשר לשחק מירוץ
-- מקור: docs/01-requirements.md, docs/02-architecture.md §3, docs/03-data-model.md
--
-- העיקרון: כל שינוי מצב משחק עובר דרך פונקציית RPC אחת (security definer)
-- שמאמתת הרשאה ומרחק בצד השרת. הקליינט לא כותב ישירות לטבלאות המשחק.
-- ─────────────────────────────────────────────────────────────

-- ── סכמה: תוספת אחת מעבר ל-docs/03 ───────────────────────────
-- "בקשת אישור" לתחנות מסוג admin_approve: הקבוצה מסמנת שסיימה,
-- והשורה נכנסת לתור האישורים של המנהל. בלי זה למנהל אין דרך לדעת שסיימו.
alter table team_progress
  add column if not exists approval_requested_at timestamptz;

-- אינדקסים לעמודות שמשמשות ב-RLS ובצירופים חמים
create index if not exists race_admins_user_idx on race_admins (user_id);
create index if not exists team_members_user_idx on team_members (user_id);
create index if not exists team_members_team_idx on team_members (team_id);
create index if not exists teams_race_idx on teams (race_id);
create index if not exists stations_race_idx on stations (race_id);
create index if not exists join_requests_race_idx on join_requests (race_id);
create index if not exists team_progress_team_idx on team_progress (team_id);

-- ─────────────────────────────────────────────────────────────
-- פונקציות עזר
-- ─────────────────────────────────────────────────────────────

-- מרחק בין שתי נקודות במטרים (Haversine) — אותה נוסחה כמו בקליינט,
-- אבל זו שקובעת: אימות ההגעה נעשה כאן.
create or replace function public.haversine_m(
  lat1 double precision, lng1 double precision,
  lat2 double precision, lng2 double precision
)
returns double precision
language sql
immutable
parallel safe
set search_path = ''
as $$
  select 2 * 6371000 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2)
    + cos(radians(lat1)) * cos(radians(lat2))
      * power(sin(radians(lng2 - lng1) / 2), 2)
  ));
$$;

-- (select auth.uid()) — נקרא פעם אחת לשאילתה במקום פעם לכל שורה
create or replace function public.is_race_admin(p_race_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.race_admins ra
    join public.races r on r.id = ra.race_id
    where ra.race_id = p_race_id
      and ra.user_id = (select auth.uid())
      and r.status <> 'archived'
  );
$$;

-- חבר קבוצה מאושר (יש לו שורה ב-team_members)
create or replace function public.is_team_member(p_team_id uuid)
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
  );
$$;

-- מנהל התורן של המירוץ שאליו שייכת הקבוצה
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
    join public.race_admins ra on ra.race_id = t.race_id
    join public.races r on r.id = t.race_id
    where t.id = p_team_id
      and ra.user_id = (select auth.uid())
      and r.status <> 'archived'
  );
$$;

create or replace function public.is_owner()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select coalesce(
    (select p.is_owner from public.profiles p where p.id = (select auth.uid())),
    false
  );
$$;

-- קוד משחק בן 6 ספרות (מקלדת מספרים בנייד — ראו design-system/components/inputs.html)
create or replace function public.generate_game_code()
returns text
language plpgsql
set search_path = ''
as $$
declare
  candidate text;
begin
  loop
    candidate := lpad((floor(random() * 1000000))::int::text, 6, '0');
    exit when not exists (select 1 from public.races where game_code = candidate);
  end loop;
  return candidate;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- RLS — הידוק לשלב 1
-- ─────────────────────────────────────────────────────────────

-- החלפת המדיניות מ-0001 שקראה ל-auth.uid() ישירות (פעם לכל שורה)
drop policy if exists profiles_update_self on profiles;
create policy profiles_update_self on profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy if exists join_requests_insert_self on join_requests;
drop policy if exists join_requests_read on join_requests;
create policy join_requests_read on join_requests for select to authenticated
  using (user_id = (select auth.uid()) or is_race_admin(race_id));
-- אין INSERT/UPDATE ישיר מהקליינט: הצטרפות ואישור עוברים דרך ה-RPC בלבד
drop policy if exists join_requests_decide on join_requests;

drop policy if exists notifications_read_self on notifications;
drop policy if exists notifications_mark_read on notifications;
create policy notifications_read_self on notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy notifications_mark_read on notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- מירוצים: יצירה/ארכוב דרך RPC; עדכון פרטים — מנהל תורן
drop policy if exists races_write on races;
create policy races_update_admin on races for update to authenticated
  using (is_race_admin(id)) with check (is_race_admin(id));

-- תחנות: קריאה למנהל בלבד. משתתף מקבל רמז/משימה רק דרך get_team_state,
-- כדי ש-task_content לא ידלוף לפני ההגעה לרדיוס.
-- (המדיניות stations_read_admin ו-stations_write מ-0001 נשארות בתוקף.)

-- סדר התחנות של קבוצה: המנהל רואה הכל; המשתתף לא רואה כלום ישירות
-- (הסדר נגזר עבורו ב-get_team_state) — אחרת אפשר לקרוא את כל התחנות מראש.
create policy team_stations_read_admin on team_stations for select to authenticated
  using (is_team_race_admin(team_id));

-- התקדמות: המנהל רואה הכל במירוץ שלו; חבר קבוצה רואה רק את הקבוצה שלו.
-- אין קריאה חוצת-קבוצות — הלידרבורד מחזיר דירוג בלבד, בלי ספירות.
create policy team_progress_read on team_progress for select to authenticated
  using (is_team_member(team_id) or is_team_race_admin(team_id));

-- דף הבית עם הספירה לאחור פתוח גם למי שלא מחובר (docs/04 §1).
-- View מצומצם בכוונה: בלי game_code ובלי נקודת הזינוק — רק מה
-- שצריך כדי לצייר את הספירה. Views רצים בהרשאות הבעלים ולכן
-- עוקפים RLS, אז כל עמודה כאן היא החלטה מודעת.
create or replace view public.public_races as
  select r.id, r.year, r.name, r.starts_at, r.status
  from public.races r
  where r.status <> 'draft';

grant select on public.public_races to anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- ניהול מירוץ (מנהל-על / מנהל תורן)
-- ─────────────────────────────────────────────────────────────

create or replace function public.create_race(
  p_year int,
  p_name text,
  p_starts_at timestamptz,
  p_start_lat double precision default null,
  p_start_lng double precision default null
)
returns public.races
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_race public.races;
begin
  if v_uid is null then
    raise exception 'לא מחובר';
  end if;
  if not public.is_owner() then
    raise exception 'רק מנהל-על יכול ליצור מירוץ';
  end if;

  insert into public.races (year, name, starts_at, game_code, status, start_lat, start_lng)
  values (p_year, p_name, p_starts_at, public.generate_game_code(), 'draft', p_start_lat, p_start_lng)
  returning * into v_race;

  -- יוצר המירוץ הוא מנהל תורן שלו
  insert into public.race_admins (race_id, user_id) values (v_race.id, v_uid);

  return v_race;
end;
$$;

create or replace function public.add_race_admin(p_race_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (public.is_owner() or public.is_race_admin(p_race_id)) then
    raise exception 'אין הרשאה למנות מנהל תורן';
  end if;
  insert into public.race_admins (race_id, user_id)
  values (p_race_id, p_user_id)
  on conflict do nothing;
end;
$$;

create or replace function public.set_race_status(p_race_id uuid, p_status public.race_status)
returns public.races
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_race public.races;
begin
  if not public.is_race_admin(p_race_id) then
    raise exception 'אין הרשאה לשנות סטטוס מירוץ';
  end if;
  -- ארכוב הוא חד-כיווני ונעשה רק דרך finish_race/archive_race
  if p_status = 'archived' then
    raise exception 'ארכוב נעשה דרך archive_race';
  end if;

  update public.races set status = p_status where id = p_race_id
  returning * into v_race;
  return v_race;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- סדר תחנות (docs/01 §4: זהה לכולם / אקראי לכל קבוצה / ידני)
-- ─────────────────────────────────────────────────────────────

create or replace function public.assign_station_order(p_race_id uuid, p_mode text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team record;
begin
  if not public.is_race_admin(p_race_id) then
    raise exception 'אין הרשאה לקבוע סדר תחנות';
  end if;
  if p_mode not in ('same', 'random') then
    raise exception 'מצב לא מוכר: %', p_mode;
  end if;
  if exists (
    select 1 from public.races r where r.id = p_race_id and r.status in ('live', 'finished')
  ) then
    raise exception 'אי אפשר לשנות סדר תחנות אחרי שהמירוץ יצא לדרך';
  end if;

  for v_team in select id from public.teams where race_id = p_race_id loop
    delete from public.team_stations where team_id = v_team.id;

    insert into public.team_stations (team_id, station_id, position)
    select v_team.id, s.id,
           row_number() over (
             order by case when p_mode = 'random' then random() else null end,
                      s.created_at
           )
    from public.stations s
    where s.race_id = p_race_id;
  end loop;
end;
$$;

-- סדר ידני לקבוצה אחת: מערך מזהי תחנות לפי הסדר הרצוי
create or replace function public.set_team_station_order(p_team_id uuid, p_station_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_team_race_admin(p_team_id) then
    raise exception 'אין הרשאה לקבוע סדר תחנות לקבוצה זו';
  end if;

  delete from public.team_stations where team_id = p_team_id;
  insert into public.team_stations (team_id, station_id, position)
  select p_team_id, sid, ord
  from unnest(p_station_ids) with ordinality as t(sid, ord);
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- זרימת הצטרפות: קוד משחק ← קוד קבוצה ← המתנה ← אישור מנהל
-- ─────────────────────────────────────────────────────────────

create or replace function public.join_race(p_game_code text, p_team_code text)
returns public.join_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_race public.races;
  v_team public.teams;
  v_request public.join_requests;
begin
  if v_uid is null then
    raise exception 'לא מחובר';
  end if;

  select * into v_race from public.races
  where game_code = btrim(p_game_code) and status in ('open', 'live');
  if v_race.id is null then
    raise exception 'קוד משחק לא תקין';
  end if;

  select * into v_team from public.teams
  where race_id = v_race.id and join_code = btrim(p_team_code);
  if v_team.id is null then
    raise exception 'קוד קבוצה לא תקין';
  end if;

  -- כבר חבר בקבוצה כלשהי במירוץ הזה? מחזירים את הבקשה המאושרת כמו שהיא
  select * into v_request from public.join_requests
  where race_id = v_race.id and user_id = v_uid;
  if v_request.id is not null and v_request.status = 'approved' then
    return v_request;
  end if;

  insert into public.join_requests (race_id, team_id, user_id, status)
  values (v_race.id, v_team.id, v_uid, 'pending')
  on conflict (race_id, user_id) do update
    set team_id = excluded.team_id,
        status = 'pending',
        decided_by = null,
        decided_at = null
  returning * into v_request;

  return v_request;
end;
$$;

create or replace function public.decide_join_request(p_request_id uuid, p_approve boolean)
returns public.join_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_request public.join_requests;
  v_name text;
  v_birth_year int;
begin
  select * into v_request from public.join_requests where id = p_request_id;
  if v_request.id is null then
    raise exception 'בקשה לא נמצאה';
  end if;
  if not public.is_race_admin(v_request.race_id) then
    raise exception 'אין הרשאה להחליט על בקשה זו';
  end if;

  update public.join_requests
  set status = case when p_approve then 'approved' else 'rejected' end::public.join_request_status,
      decided_by = v_uid,
      decided_at = now()
  where id = p_request_id
  returning * into v_request;

  if p_approve then
    select coalesce(p.full_name, 'משתתף'), p.birth_year
      into v_name, v_birth_year
    from public.profiles p where p.id = v_request.user_id;

    insert into public.team_members (team_id, user_id, display_name, birth_year)
    values (v_request.team_id, v_request.user_id, v_name, v_birth_year)
    on conflict (team_id, user_id) do update set display_name = excluded.display_name;
  end if;

  return v_request;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- מהלך המשחק
-- ─────────────────────────────────────────────────────────────

-- מצב הקבוצה: התחנה הנוכחית = ה-position הנמוך ביותר ללא completed_at.
-- לפני ההגעה מחזירים רמז + נקודה + רדיוס בלבד; שם התחנה, סיפור הרקע
-- ותוכן המשימה נחשפים רק אחרי אימות ההגעה בשרת.
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
begin
  if not (public.is_team_member(p_team_id) or v_is_admin) then
    raise exception 'אין הרשאה לצפות בקבוצה זו';
  end if;

  select * into v_team from public.teams where id = p_team_id;
  select * into v_race from public.races where id = v_team.race_id;

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
      'race', jsonb_build_object('id', v_race.id, 'name', v_race.name, 'status', v_race.status),
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
    'race', jsonb_build_object('id', v_race.id, 'name', v_race.name, 'status', v_race.status),
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

-- אימות הגעה — כאן ורק כאן. הקליינט שולח את הקואורדינטות שלו,
-- השרת מחשב מרחק מול הרדיוס. דיוק GPS גרוע מרחיב את הסף עד 100 מ׳ נוספים.
create or replace function public.arrive_at_station(
  p_team_id uuid,
  p_lat double precision,
  p_lng double precision,
  p_accuracy_m double precision default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_station public.stations;
  v_distance double precision;
  v_allowed double precision;
begin
  if not public.is_team_member(p_team_id) then
    raise exception 'אין הרשאה — לא חבר בקבוצה זו';
  end if;
  if not exists (
    select 1 from public.teams t join public.races r on r.id = t.race_id
    where t.id = p_team_id and r.status = 'live'
  ) then
    raise exception 'המירוץ לא פעיל';
  end if;

  select s.* into v_station
  from public.team_stations ts
  join public.stations s on s.id = ts.station_id
  left join public.team_progress tp
    on tp.team_id = ts.team_id and tp.station_id = ts.station_id
  where ts.team_id = p_team_id and tp.completed_at is null
  order by ts.position
  limit 1;

  if v_station.id is null then
    raise exception 'אין תחנה פעילה';
  end if;

  v_distance := public.haversine_m(p_lat, p_lng, v_station.lat, v_station.lng);
  v_allowed := v_station.radius_m + least(coalesce(p_accuracy_m, 0), 100);

  if v_distance > v_allowed then
    return jsonb_build_object('arrived', false, 'distance_m', round(v_distance)::int);
  end if;

  insert into public.team_progress (team_id, station_id, arrived_at)
  values (p_team_id, v_station.id, now())
  on conflict (team_id, station_id) do update
    set arrived_at = coalesce(team_progress.arrived_at, now());

  return jsonb_build_object('arrived', true, 'distance_m', round(v_distance)::int);
end;
$$;

-- עקיפת GPS ע"י המנהל (docs/02 §3.1 — עדיף חוויה טובה על אכיפה מושלמת)
create or replace function public.admin_open_station(p_team_id uuid, p_station_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_team_race_admin(p_team_id) then
    raise exception 'אין הרשאה לפתוח משימה לקבוצה זו';
  end if;

  insert into public.team_progress (team_id, station_id, arrived_at)
  values (p_team_id, p_station_id, now())
  on conflict (team_id, station_id) do update
    set arrived_at = coalesce(team_progress.arrived_at, now());
end;
$$;

-- השלמת תחנה. סוג ההשלמה נקבע בתחנה — הקליינט לא בוחר.
create or replace function public.complete_station(
  p_team_id uuid,
  p_secret_code text default null,
  p_proof_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_station public.stations;
  v_progress public.team_progress;
begin
  if not public.is_team_member(p_team_id) then
    raise exception 'אין הרשאה — לא חבר בקבוצה זו';
  end if;

  select s.* into v_station
  from public.team_stations ts
  join public.stations s on s.id = ts.station_id
  left join public.team_progress tp
    on tp.team_id = ts.team_id and tp.station_id = ts.station_id
  where ts.team_id = p_team_id and tp.completed_at is null
  order by ts.position
  limit 1;

  if v_station.id is null then
    raise exception 'אין תחנה פעילה';
  end if;

  select * into v_progress from public.team_progress
  where team_id = p_team_id and station_id = v_station.id;

  if v_progress.arrived_at is null then
    raise exception 'עוד לא הגעתם לתחנה';
  end if;

  case v_station.completion_type
    when 'auto' then
      update public.team_progress set completed_at = now()
      where team_id = p_team_id and station_id = v_station.id;

    when 'secret_code' then
      if v_station.secret_code is null
         or upper(btrim(coalesce(p_secret_code, ''))) <> upper(btrim(v_station.secret_code)) then
        return jsonb_build_object('ok', false, 'error', 'הקוד לא נכון');
      end if;
      update public.team_progress set completed_at = now()
      where team_id = p_team_id and station_id = v_station.id;

    when 'photo_upload' then
      if coalesce(btrim(p_proof_url), '') = '' then
        return jsonb_build_object('ok', false, 'error', 'צריך להעלות תמונה');
      end if;
      update public.team_progress set completed_at = now(), proof_url = p_proof_url
      where team_id = p_team_id and station_id = v_station.id;

    when 'admin_approve' then
      -- לא משלימים כאן — נכנסים לתור האישורים של המנהל
      update public.team_progress
      set approval_requested_at = now(), proof_url = coalesce(p_proof_url, proof_url)
      where team_id = p_team_id and station_id = v_station.id;
      return jsonb_build_object('ok', true, 'awaiting_approval', true);
    else
      raise exception 'סוג השלמה לא מוכר: %', v_station.completion_type;
  end case;

  return jsonb_build_object('ok', true, 'awaiting_approval', false);
end;
$$;

create or replace function public.admin_decide_station(
  p_team_id uuid,
  p_station_id uuid,
  p_approve boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_team_race_admin(p_team_id) then
    raise exception 'אין הרשאה לאשר משימות לקבוצה זו';
  end if;

  if p_approve then
    update public.team_progress
    set completed_at = now(), approved_by = (select auth.uid())
    where team_id = p_team_id and station_id = p_station_id and completed_at is null;
  else
    update public.team_progress
    set approval_requested_at = null
    where team_id = p_team_id and station_id = p_station_id and completed_at is null;
  end if;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- לידרבורד — דירוג בלבד (docs/02 §3.3)
-- security definer כדי לחשב על פני כל הקבוצות, אבל מחזיר אך ורק
-- מקום בדירוג: לא כמה משימות הושלמו ולא מתוך כמה.
-- ─────────────────────────────────────────────────────────────

create or replace function public.get_leaderboard(p_race_id uuid)
returns table (
  rank int,
  team_id uuid,
  team_name text,
  team_color text,
  team_animal text
)
language sql
security definer
stable
set search_path = ''
as $$
  with scored as (
    select t.id, t.name, t.color, t.animal,
           count(tp.completed_at) as done,
           max(tp.completed_at) as last_done
    from public.teams t
    left join public.team_progress tp
      on tp.team_id = t.id and tp.completed_at is not null
    where t.race_id = p_race_id
    group by t.id, t.name, t.color, t.animal
  )
  select (row_number() over (order by done desc, last_done asc nulls last, name))::int,
         id, name, color, animal
  from scored;
$$;

-- ─────────────────────────────────────────────────────────────
-- סיום מירוץ, הכרזת זוכים, ארכוב
-- ─────────────────────────────────────────────────────────────

create or replace function public.finish_race(p_race_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_race public.races;
  v_winner record;
  v_members jsonb;
begin
  if not public.is_race_admin(p_race_id) then
    raise exception 'אין הרשאה לסיים מירוץ זה';
  end if;

  update public.races set status = 'finished' where id = p_race_id
  returning * into v_race;

  select * into v_winner from public.get_leaderboard(p_race_id) where rank = 1;
  if v_winner.team_id is null then
    return jsonb_build_object('winner', null);
  end if;

  select coalesce(jsonb_agg(tm.display_name order by tm.display_name), '[]'::jsonb)
    into v_members
  from public.team_members tm where tm.team_id = v_winner.team_id;

  insert into public.hall_of_fame (year, race_id, team_name, team_color, members)
  values (v_race.year, v_race.id, v_winner.team_name, v_winner.team_color, v_members)
  on conflict (year) do update
    set race_id = excluded.race_id,
        team_name = excluded.team_name,
        team_color = excluded.team_color,
        members = excluded.members;

  return jsonb_build_object(
    'winner', jsonb_build_object(
      'team_id', v_winner.team_id,
      'name', v_winner.team_name,
      'color', v_winner.team_color,
      'animal', v_winner.team_animal,
      'members', v_members
    )
  );
end;
$$;

-- ארכוב — חד-כיווני. אחרי זה is_race_admin מחזיר false ואין יותר עריכה לאיש.
create or replace function public.archive_race(p_race_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_race_admin(p_race_id) then
    raise exception 'אין הרשאה לארכב מירוץ זה';
  end if;
  update public.races set status = 'archived' where id = p_race_id;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- Storage — תמונות הוכחה לתחנות מסוג photo_upload.
-- הקובץ עצמו קריא לכל מי שיש לו הקישור (המנהל צריך לראות אותו
-- בתור האישורים), אבל העלאה מותרת רק למשתמש מחובר ורק לתיקייה
-- שנושאת את מזהה הקבוצה שלו.
-- ─────────────────────────────────────────────────────────────
do $$
begin
  if exists (select 1 from information_schema.tables
             where table_schema = 'storage' and table_name = 'objects') then

    insert into storage.buckets (id, name, public)
    values ('proofs', 'proofs', true)
    on conflict (id) do nothing;

    drop policy if exists proofs_read on storage.objects;
    create policy proofs_read on storage.objects for select
      using (bucket_id = 'proofs');

    drop policy if exists proofs_insert on storage.objects;
    create policy proofs_insert on storage.objects for insert to authenticated
      with check (
        bucket_id = 'proofs'
        and public.is_team_member(((storage.foldername(name))[1])::uuid)
      );
  end if;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- Realtime — מסך ההמתנה (אושרה הבקשה?) ומסך המשחק (התקדמות).
-- Realtime מכבד RLS, ולכן משתתף מקבל אירועים רק על השורות שלו.
-- ─────────────────────────────────────────────────────────────
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.join_requests;
    alter publication supabase_realtime add table public.team_progress;
  end if;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- הרשאות הרצה: רק משתמש מחובר. anon לא מריץ שום פונקציית משחק.
-- ─────────────────────────────────────────────────────────────
revoke execute on function
  public.generate_game_code(),
  public.haversine_m(double precision, double precision, double precision, double precision),
  public.create_race(int, text, timestamptz, double precision, double precision),
  public.add_race_admin(uuid, uuid),
  public.set_race_status(uuid, public.race_status),
  public.assign_station_order(uuid, text),
  public.set_team_station_order(uuid, uuid[]),
  public.join_race(text, text),
  public.decide_join_request(uuid, boolean),
  public.get_team_state(uuid),
  public.arrive_at_station(uuid, double precision, double precision, double precision),
  public.admin_open_station(uuid, uuid),
  public.complete_station(uuid, text, text),
  public.admin_decide_station(uuid, uuid, boolean),
  public.get_leaderboard(uuid),
  public.finish_race(uuid),
  public.archive_race(uuid)
from public, anon;

grant execute on function
  public.create_race(int, text, timestamptz, double precision, double precision),
  public.add_race_admin(uuid, uuid),
  public.set_race_status(uuid, public.race_status),
  public.assign_station_order(uuid, text),
  public.set_team_station_order(uuid, uuid[]),
  public.join_race(text, text),
  public.decide_join_request(uuid, boolean),
  public.get_team_state(uuid),
  public.arrive_at_station(uuid, double precision, double precision, double precision),
  public.admin_open_station(uuid, uuid),
  public.complete_station(uuid, text, text),
  public.admin_decide_station(uuid, uuid, boolean),
  public.get_leaderboard(uuid),
  public.finish_race(uuid),
  public.archive_race(uuid)
to authenticated;
