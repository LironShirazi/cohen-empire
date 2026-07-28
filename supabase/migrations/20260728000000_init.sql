-- המירוץ למיליון — סכמה ראשונית (docs/03-data-model.md)

-- ========== Enums ==========
create type race_status as enum ('draft', 'open', 'live', 'finished', 'archived');
create type join_request_status as enum ('pending', 'approved', 'rejected');
create type completion_type as enum ('admin_approve', 'secret_code', 'photo_upload', 'auto');

-- ========== profiles ==========
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  avatar_url text,
  birth_year int,
  is_owner boolean not null default false,
  created_at timestamptz not null default now()
);

-- יצירת פרופיל אוטומטית בהתחברות ראשונה עם Google
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

-- ========== races ==========
create table races (
  id uuid primary key default gen_random_uuid(),
  year int not null unique,
  name text not null,
  starts_at timestamptz,
  game_code text unique,
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

-- ========== teams ==========
create table teams (
  id uuid primary key default gen_random_uuid(),
  race_id uuid not null references races (id) on delete cascade,
  name text not null,
  color text not null default '#c2410c',
  animal text not null default '🦁',
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
  created_at timestamptz not null default now()
);

-- ========== stations ==========
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

-- ========== messages (צ'אט קבוצתי) ==========
create table messages (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams (id) on delete cascade,
  sender_id uuid not null references profiles (id) on delete cascade,
  body text,
  attachment_url text,
  attachment_type text,
  created_at timestamptz not null default now()
);

-- ========== תוכן משפחתי ==========
create table quotes (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  who text not null, -- "סבא" / "סבתא"
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
  team_animal text,
  members jsonb not null default '[]',
  photo_url text,
  created_at timestamptz not null default now()
);

-- ========== Helper: האם המשתמש מנהל תורן של מירוץ פעיל ==========
create function is_race_admin(p_race_id uuid)
returns boolean
language sql
stable
security definer set search_path = ''
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

create function is_approved_team_member(p_team_id uuid)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists (
    select 1 from public.team_members tm
    where tm.team_id = p_team_id and tm.user_id = auth.uid()
  );
$$;

-- ========== RLS ==========
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
alter table quotes enable row level security;
alter table gallery_photos enable row level security;
alter table hall_of_fame enable row level security;

-- profiles: כל מחובר קורא, כל אחד מעדכן את עצמו
create policy profiles_read on profiles for select to authenticated using (true);
create policy profiles_update_self on profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- races: קריאה פתוחה (ספירה לאחור בדף הבית), כתיבה למנהל-על ולמנהלי המירוץ
create policy races_read on races for select using (true);
create policy races_insert_owner on races for insert to authenticated
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.is_owner));
create policy races_update_admin on races for update to authenticated
  using (
    is_race_admin(id)
    or exists (select 1 from profiles p where p.id = auth.uid() and p.is_owner)
  );

-- race_admins: קריאה למחוברים, ניהול ע"י מנהל-על
create policy race_admins_read on race_admins for select to authenticated using (true);
create policy race_admins_write on race_admins for all to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_owner))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.is_owner));

-- teams: כולם רואים את כל הקבוצות (דרישה מפורשת); כתיבה למנהלי המירוץ
create policy teams_read on teams for select to authenticated using (true);
create policy teams_write on teams for all to authenticated
  using (is_race_admin(race_id)) with check (is_race_admin(race_id));

-- team_members: קריאה למחוברים (רואים הרכבים); כתיבה למנהלי המירוץ
create policy team_members_read on team_members for select to authenticated using (true);
create policy team_members_write on team_members for all to authenticated
  using (exists (select 1 from teams t where t.id = team_id and is_race_admin(t.race_id)))
  with check (exists (select 1 from teams t where t.id = team_id and is_race_admin(t.race_id)));

-- join_requests: משתמש יוצר ורואה את שלו; מנהלי המירוץ רואים ומחליטים
create policy join_requests_insert_self on join_requests for insert to authenticated
  with check (user_id = auth.uid());
create policy join_requests_read on join_requests for select to authenticated
  using (user_id = auth.uid() or is_race_admin(race_id));
create policy join_requests_update_admin on join_requests for update to authenticated
  using (is_race_admin(race_id));

-- stations: כתיבה למנהלי המירוץ; קריאה למנהלים בלבד ברמת הטבלה —
-- task_content/רמזים נחשפים למשתתפים דרך RPC/views ייעודיים בהמשך (שלב 1)
create policy stations_admin_all on stations for all to authenticated
  using (is_race_admin(race_id)) with check (is_race_admin(race_id));

create policy team_stations_admin_all on team_stations for all to authenticated
  using (exists (select 1 from teams t where t.id = team_id and is_race_admin(t.race_id)))
  with check (exists (select 1 from teams t where t.id = team_id and is_race_admin(t.race_id)));

create policy team_stations_member_read on team_stations for select to authenticated
  using (is_approved_team_member(team_id));

-- team_progress: קבוצה רואה את שלה, מנהלים הכל; כתיבה דרך RPC בצד שרת (שלב 1)
create policy team_progress_read on team_progress for select to authenticated
  using (
    is_approved_team_member(team_id)
    or exists (select 1 from teams t where t.id = team_id and is_race_admin(t.race_id))
  );

-- messages: חברי קבוצה מאושרים + מנהלי המירוץ
create policy messages_read on messages for select to authenticated
  using (
    is_approved_team_member(team_id)
    or exists (select 1 from teams t where t.id = team_id and is_race_admin(t.race_id))
  );
create policy messages_insert on messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and (
      is_approved_team_member(team_id)
      or exists (select 1 from teams t where t.id = team_id and is_race_admin(t.race_id))
    )
  );

-- תוכן משפחתי: קריאה פתוחה, כתיבה למנהל-על (גלריה: כל מחובר מעלה)
create policy quotes_read on quotes for select using (true);
create policy quotes_write on quotes for all to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_owner))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.is_owner));

create policy gallery_read on gallery_photos for select using (true);
create policy gallery_insert on gallery_photos for insert to authenticated
  with check (uploaded_by = auth.uid());
create policy gallery_manage on gallery_photos for delete to authenticated
  using (
    uploaded_by = auth.uid()
    or exists (select 1 from profiles p where p.id = auth.uid() and p.is_owner)
    or (race_id is not null and is_race_admin(race_id))
  );

create policy hall_of_fame_read on hall_of_fame for select using (true);
create policy hall_of_fame_write on hall_of_fame for all to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_owner))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.is_owner));

-- ========== לידרבורד: דירוג בלבד, בלי לחשוף כמה משימות הושלמו ==========
create view leaderboard with (security_invoker = false) as
select
  t.race_id,
  t.id as team_id,
  t.name,
  t.color,
  t.animal,
  rank() over (
    partition by t.race_id
    order by
      count(tp.completed_at) desc,
      max(tp.completed_at) asc nulls last
  ) as rank
from teams t
left join team_progress tp
  on tp.team_id = t.id and tp.completed_at is not null
group by t.race_id, t.id, t.name, t.color, t.animal;
