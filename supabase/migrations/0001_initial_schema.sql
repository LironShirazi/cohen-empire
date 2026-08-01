-- ─────────────────────────────────────────────────────────────
-- המירוץ למיליון — סכמה ראשונית (שלב 0)
-- מקור: docs/03-data-model.md
-- ─────────────────────────────────────────────────────────────

-- enums
create type race_status as enum ('draft', 'open', 'live', 'finished', 'archived');
create type join_request_status as enum ('pending', 'approved', 'rejected');
create type completion_type as enum ('admin_approve', 'secret_code', 'photo_upload', 'auto');
create type notification_type as enum ('mention', 'task_approved', 'admin_broadcast');

-- ── משתמשים ──────────────────────────────────────────────────
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  avatar_url text,
  birth_year int,
  is_owner boolean not null default false,
  created_at timestamptz not null default now()
);

-- נוצר אוטומטית בהתחברות ראשונה עם Google
create function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ── מירוצים ──────────────────────────────────────────────────
create table races (
  id uuid primary key default gen_random_uuid(),
  year int not null unique,
  name text not null,
  starts_at timestamptz,
  game_code text not null unique,
  status race_status not null default 'draft',
  start_lat double precision,
  start_lng double precision,
  created_at timestamptz not null default now()
);

create table race_admins (
  race_id uuid not null references races (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  primary key (race_id, user_id)
);

-- ── קבוצות ───────────────────────────────────────────────────
create table teams (
  id uuid primary key default gen_random_uuid(),
  race_id uuid not null references races (id) on delete cascade,
  name text not null,
  color text not null default '#d99a26',
  animal text,
  join_code text not null,
  created_at timestamptz not null default now(),
  unique (race_id, join_code)
);

create table team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams (id) on delete cascade,
  user_id uuid references profiles (id) on delete cascade, -- null = משתתף ידני
  display_name text not null,
  birth_year int,
  ability int check (ability between 1 and 5),
  created_at timestamptz not null default now(),
  unique (team_id, user_id)
);

create table join_requests (
  id uuid primary key default gen_random_uuid(),
  race_id uuid not null references races (id) on delete cascade,
  team_id uuid not null references teams (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  status join_request_status not null default 'pending',
  decided_by uuid references profiles (id),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  unique (race_id, user_id)
);

-- ── תחנות והתקדמות ───────────────────────────────────────────
create table stations (
  id uuid primary key default gen_random_uuid(),
  race_id uuid not null references races (id) on delete cascade,
  name text not null,
  backstory text,
  clue jsonb,
  task_content jsonb,
  lat double precision not null,
  lng double precision not null,
  radius_m int not null default 75,
  completion_type completion_type not null default 'admin_approve',
  secret_code text,
  created_at timestamptz not null default now()
);

create table team_stations (
  team_id uuid not null references teams (id) on delete cascade,
  station_id uuid not null references stations (id) on delete cascade,
  position int not null,
  primary key (team_id, station_id),
  unique (team_id, position)
);

create table team_progress (
  team_id uuid not null references teams (id) on delete cascade,
  station_id uuid not null references stations (id) on delete cascade,
  arrived_at timestamptz,
  completed_at timestamptz,
  approved_by uuid references profiles (id),
  proof_url text,
  primary key (team_id, station_id)
);

-- ── צ'אט והתראות ─────────────────────────────────────────────
create table messages (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams (id) on delete cascade,
  sender_id uuid not null references profiles (id) on delete cascade,
  body text,
  attachment_url text,
  attachment_type text,
  mentioned_user_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  type notification_type not null,
  race_id uuid references races (id) on delete cascade,
  team_id uuid references teams (id) on delete cascade,
  message_id uuid references messages (id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_unread_idx on notifications (user_id) where read_at is null;

-- ההתראה נוצרת בצד השרת — מקור אמת אחד, לא ניתן לזיוף מהקליינט
create function handle_message_mentions()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  mentioned uuid;
  v_race_id uuid;
begin
  select race_id into v_race_id from public.teams where id = new.team_id;
  foreach mentioned in array new.mentioned_user_ids loop
    if mentioned <> new.sender_id then
      insert into public.notifications (user_id, type, race_id, team_id, message_id)
      values (mentioned, 'mention', v_race_id, new.team_id, new.id);
    end if;
  end loop;
  return new;
end;
$$;

create trigger on_message_mentions
  after insert on messages
  for each row
  when (new.mentioned_user_ids <> '{}')
  execute function handle_message_mentions();

-- ── תוכן משפחתי ──────────────────────────────────────────────
create table quotes (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  who text not null, -- 'סבא' / 'סבתא'
  image_url text,
  created_at timestamptz not null default now()
);

create table gallery_photos (
  id uuid primary key default gen_random_uuid(),
  race_id uuid references races (id) on delete set null,
  url text not null,
  caption text,
  uploaded_by uuid references profiles (id),
  created_at timestamptz not null default now()
);

create table hall_of_fame (
  id uuid primary key default gen_random_uuid(),
  year int not null unique,
  race_id uuid references races (id) on delete set null,
  team_name text not null,
  team_color text,
  members jsonb not null default '[]',
  photo_url text
);

create table family_members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  gender text,
  birth_year int,
  phone text,
  photo_url text,
  father_id uuid references family_members (id) on delete set null,
  mother_id uuid references family_members (id) on delete set null,
  partner_id uuid references family_members (id) on delete set null,
  profile_id uuid references profiles (id) on delete set null,
  is_root boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- RLS בסיסי (שלב 0) — מהודק יותר בשלב 1
-- ─────────────────────────────────────────────────────────────
alter table profiles enable row level security;
alter table races enable row level security;
alter table race_admins enable row level security;
alter table teams enable row level security;
alter table team_members enable row level security;
alter table join_requests enable row level security;
alter table stations enable row level security;
alter table team_stations enable row level security;
alter table team_progress enable row level security;
alter table messages enable row level security;
alter table notifications enable row level security;
alter table quotes enable row level security;
alter table gallery_photos enable row level security;
alter table hall_of_fame enable row level security;
alter table family_members enable row level security;

-- עזר: האם המשתמש הנוכחי מנהל תורן של המירוץ (ולא בארכיון)
create function is_race_admin(p_race_id uuid)
returns boolean
language sql
security definer set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.race_admins ra
    join public.races r on r.id = ra.race_id
    where ra.race_id = p_race_id
      and ra.user_id = auth.uid()
      and r.status <> 'archived'
  );
$$;

-- פרופילים: כל מחובר קורא (שמות בקבוצות), כל אחד מעדכן רק את עצמו
create policy profiles_read on profiles for select to authenticated using (true);
create policy profiles_update_self on profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- מירוצים וקבוצות: קריאה לכל מחובר (דרישה — כולם רואים את כל הקבוצות)
create policy races_read on races for select to authenticated using (true);
create policy teams_read on teams for select to authenticated using (true);
create policy team_members_read on team_members for select to authenticated using (true);
create policy race_admins_read on race_admins for select to authenticated using (true);

-- כתיבה על ישויות מירוץ — רק מנהל תורן של אותו מירוץ
create policy races_write on races for update to authenticated
  using (is_race_admin(id));
create policy teams_write on teams for all to authenticated
  using (is_race_admin(race_id)) with check (is_race_admin(race_id));
create policy stations_write on stations for all to authenticated
  using (is_race_admin(race_id)) with check (is_race_admin(race_id));

-- תחנות: קריאה למנהל בלבד בשלב זה (task_content לפי הגעה — נוסיף בשלב 1)
create policy stations_read_admin on stations for select to authenticated
  using (is_race_admin(race_id));

-- בקשות הצטרפות: משתמש יוצר ורואה את שלו; מנהל רואה ומחליט על של המירוץ שלו
create policy join_requests_insert_self on join_requests for insert to authenticated
  with check (user_id = auth.uid());
create policy join_requests_read on join_requests for select to authenticated
  using (user_id = auth.uid() or is_race_admin(race_id));
create policy join_requests_decide on join_requests for update to authenticated
  using (is_race_admin(race_id));

-- התראות: רק הנמען קורא ומסמן כנקראה; אין INSERT מהקליינט (רק הטריגר)
create policy notifications_read_self on notifications for select to authenticated
  using (user_id = auth.uid());
create policy notifications_mark_read on notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- תוכן משפחתי: קריאה לכל מחובר
create policy quotes_read on quotes for select to authenticated using (true);
create policy gallery_read on gallery_photos for select to authenticated using (true);
create policy hall_of_fame_read on hall_of_fame for select to authenticated using (true);
create policy family_members_read on family_members for select to authenticated using (true);
