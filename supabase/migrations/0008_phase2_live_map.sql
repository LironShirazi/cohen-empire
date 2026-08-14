-- ─────────────────────────────────────────────────────────────
-- שלב 2 — מפת מנהל חיה עם מיקומי הקבוצות
-- מקור: docs/01 §4 ("מעקב מיקום קבוצות על מפה"), docs/04 §4
-- ("מפה עם מיקום אחרון של כל קבוצה"), docs/05 שלב 2
--
-- **שורה אחת לקבוצה, לא שובל.** המסך צריך "איפה הם עכשיו", ושמירת
-- היסטוריה הייתה מוסיפה אלפי שורות למירוץ אחד + החלטת שימור, בלי
-- שאף מסך יציג אותן. אם יום אחד ירצו "מסלול הקבוצה" — זו טבלה
-- נפרדת, לא שינוי של זו.
--
-- ⚠️ **הטבלה הזו לא משתתפת בשום החלטת משחק.** פתיחת משימה נשענת
-- אך ורק על הקואורדינטות שנשלחות ל-arrive_at_station ומאומתות שם
-- מול הרדיוס (docs/02 §3.1). מי שיקרא מכאן מרחק — עוקף את האימות,
-- כי כאן נשמר מה שהמכשיר דיווח בלי הצלבה מול שום דבר.
-- ─────────────────────────────────────────────────────────────

create table if not exists public.team_locations (
  team_id uuid primary key references public.teams (id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  accuracy_m double precision,
  -- מי מהקבוצה דיווח אחרון — כדי שהמנהל יידע את מי לצלצל
  reported_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.team_locations enable row level security;

-- ─────────────────────────────────────────────────────────────
-- קריאה: **המנהל התורן בלבד.**
-- משתתף לא רואה איפה קבוצה אחרת נמצאת — זו אותה הסיבה שהלידרבורד
-- מחזיר דירוג בלבד (docs/02 §3.3): המתח הוא חצי מהמשחק.
-- ─────────────────────────────────────────────────────────────
drop policy if exists team_locations_read_admin on public.team_locations;
create policy team_locations_read_admin on public.team_locations
  for select to authenticated
  using (public.is_team_race_admin(team_id));

-- ─────────────────────────────────────────────────────────────
-- כתיבה: רק דרך ה-RPC.
--
-- אין מדיניות INSERT/UPDATE בכוונה. מה שהמכשיר מדווח על עצמו אי
-- אפשר לאמת ממילא, אבל `updated_at` ו-`reported_by` כן חייבים להיות
-- אמינים: המפה מציגה "עודכן לפני 3 דק'", ושדה שהקליינט קובע היה
-- הופך את הסימון הזה לחסר ערך בדיוק כשהוא הכי חשוב (קבוצה שנתקעה).
-- ─────────────────────────────────────────────────────────────
create or replace function public.report_team_location(
  p_team_id uuid,
  p_lat double precision,
  p_lng double precision,
  p_accuracy_m double precision default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_team_member(p_team_id) then
    raise exception 'אפשר לדווח מיקום רק לקבוצה שאתם חברים בה';
  end if;

  insert into public.team_locations (
    team_id, lat, lng, accuracy_m, reported_by, updated_at
  )
  values (
    p_team_id, p_lat, p_lng, p_accuracy_m, (select auth.uid()), now()
  )
  on conflict (team_id) do update
    set lat = excluded.lat,
        lng = excluded.lng,
        accuracy_m = excluded.accuracy_m,
        reported_by = excluded.reported_by,
        updated_at = now();
end;
$$;

revoke execute on function
  public.report_team_location(uuid, double precision, double precision, double precision)
  from public, anon;
grant execute on function
  public.report_team_location(uuid, double precision, double precision, double precision)
  to authenticated;

-- ─────────────────────────────────────────────────────────────
-- אין Realtime על הטבלה הזו בכוונה: מסך "מהלך המירוץ" כבר מרענן
-- את עצמו כל 8 שניות (LivePanel), והמפה יושבת על אותו המסך ומקבלת
-- את הנתונים מאותו רינדור. ערוץ שני לאותו מסך לא היה מוסיף כלום.
-- ─────────────────────────────────────────────────────────────
