-- ─────────────────────────────────────────────────────────────
-- אנליטיקה — מי נכנס לאפליקציה, מתי ולאן
--
-- לפני שהאפליקציה נשלחת למשפחה, מנהל-על רוצה לדעת מי פתח אותה.
-- Vercel Web Analytics (ב-layout) עונה על "כמה" באופן אנונימי;
-- הטבלה כאן עונה על "מי" — כל כניסה למסך נרשמת עם המשתמש המחובר.
--
-- ⚠️ **אין גישה ישירה לטבלה — לא לכתיבה ולא לקריאה.** הכתיבה עוברת
-- דרך `log_page_view` (שקובעת את `user_id` מ-`auth.uid()` ולא
-- מהקליינט), והקריאה דרך `get_app_stats` בלבד. אין כאן מדיניות RLS
-- בכלל, בכוונה: מי שיוסיף מדיניות SELECT חושף לכל המשפחה מי נכנס
-- מתי — זה מידע של מנהל-על, לא של המנהל התורן של השנה.
--
-- ⚠️ **`get_app_stats` היא `is_owner()` בלבד** ולא `is_race_admin()`.
-- הסטטיסטיקה היא על האפליקציה כולה ולא על מירוץ, ומנהל תורן הוא
-- תפקיד של שנה אחת (docs/01 §2).
--
-- ⚠️ **ההצטברות בשרת ולא ב-TS.** PostgREST מחזיר עד 1000 שורות,
-- וסיכום בצד האפליקציה היה סופר בשקט רק את ההתחלה.
--
-- ⚠️ **ימים ושעות לפי `Asia/Jerusalem`** — אחרת "היום" מתחלף ב-3 בלילה
-- ושעות השיא זזות בשעתיים-שלוש (אותה מלכודת של מסך הזוכים, 0015).
-- ─────────────────────────────────────────────────────────────

create table public.page_views (
  id bigint generated always as identity primary key,
  -- null = מבקר שלא התחבר (דף הבית פתוח לכולם)
  user_id uuid references public.profiles(id) on delete set null,
  -- מזהה מכשיר אנונימי מ-localStorage: סופר מכשירים, כולל לא מחוברים
  visitor_id uuid not null,
  -- מנורמל בקליינט: מזהי uuid הופכים ל-[id]
  path text not null check (char_length(path) <= 200),
  created_at timestamptz not null default now()
);

create index page_views_created_at_idx on public.page_views (created_at);
create index page_views_visitor_idx on public.page_views (visitor_id, created_at);
create index page_views_user_idx on public.page_views (user_id, created_at);

alter table public.page_views enable row level security;
revoke all on public.page_views from anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- רישום כניסה למסך
--
-- פתוחה גם ל-anon: דף הבית נפתח לפני התחברות, ובדיוק שם רוצים לדעת
-- כמה הגיעו מהקישור ולא המשיכו.
--
-- כפילות של אותו מכשיר לאותו מסך בתוך 30 שניות נבלעת — רענון,
-- והאפקט הכפול של React StrictMode בפיתוח.
-- ─────────────────────────────────────────────────────────────

create or replace function public.log_page_view(
  p_path text,
  p_visitor_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_path text := left(coalesce(nullif(trim(p_path), ''), '/'), 200);
  -- דרך profiles ולא auth.uid() ישירות: משתמש בלי שורת פרופיל היה
  -- נכשל על ה-foreign key, ואנליטיקה לא שוברת שום דבר
  v_user uuid := (
    select p.id from public.profiles p where p.id = (select auth.uid())
  );
begin
  if p_visitor_id is null then
    return;
  end if;

  if exists (
    select 1 from public.page_views pv
    where pv.visitor_id = p_visitor_id
      and pv.path = v_path
      and pv.created_at > now() - interval '30 seconds'
  ) then
    return;
  end if;

  insert into public.page_views (user_id, visitor_id, path)
  values (v_user, p_visitor_id, v_path);
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- הסטטיסטיקה למסך `/admin/stats`
--
-- ⚠️ **מנהלי-על מוחרגים כברירת מחדל** — וגם כל מכשיר שאי פעם התחבר
-- כמנהל-על, כדי שהגלישה שלו לפני ההתחברות לא תיספר כ"מבקר אנונימי".
-- בלי זה הבדיקות של מי שבנה את המירוץ מנפחות כל גרף.
-- ─────────────────────────────────────────────────────────────

create or replace function public.get_app_stats(
  p_days int default 30,
  p_include_owners boolean default false
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tz constant text := 'Asia/Jerusalem';
  v_days int := least(greatest(coalesce(p_days, 30), 1), 366);
  v_today date := (now() at time zone v_tz)::date;
  v_from date := v_today - (v_days - 1);
  v_result jsonb;
begin
  if not public.is_owner() then
    raise exception 'רק מנהל-על רשאי לראות סטטיסטיקות';
  end if;

  with owner_devices as (
    select distinct pv.visitor_id
    from public.page_views pv
    join public.profiles p on p.id = pv.user_id
    where p.is_owner
  ),
  v as (
    select
      pv.user_id,
      pv.visitor_id,
      pv.path,
      (pv.created_at at time zone v_tz) as local_ts
    from public.page_views pv
    where pv.created_at >= (v_from::timestamp at time zone v_tz)
      and (
        p_include_owners
        or pv.visitor_id not in (select visitor_id from owner_devices)
      )
  )
  select jsonb_build_object(
    'days', v_days,

    'summary', (
      select jsonb_build_object(
        'views', count(*),
        'visitors', count(distinct v.visitor_id),
        'users', count(distinct v.user_id),
        'today_views', count(*) filter (where v.local_ts::date = v_today),
        'today_visitors',
          count(distinct v.visitor_id) filter (where v.local_ts::date = v_today)
      )
      from v
    ),

    -- כל יום בטווח, גם ימים בלי אף כניסה — אחרת הגרף מדלג עליהם
    'daily', (
      select jsonb_agg(
        jsonb_build_object(
          'day', d.day,
          'views', coalesce(x.views, 0),
          'visitors', coalesce(x.visitors, 0)
        )
        order by d.day
      )
      from (
        select g::date as day
        from generate_series(v_from::timestamp, v_today::timestamp, interval '1 day') g
      ) d
      left join (
        select
          v.local_ts::date as day,
          count(*) as views,
          count(distinct v.visitor_id) as visitors
        from v
        group by 1
      ) x on x.day = d.day
    ),

    'hourly', (
      select jsonb_agg(
        jsonb_build_object('hour', h.hour, 'views', coalesce(x.views, 0))
        order by h.hour
      )
      from generate_series(0, 23) as h(hour)
      left join (
        select extract(hour from v.local_ts)::int as hour, count(*) as views
        from v
        group by 1
      ) x on x.hour = h.hour
    ),

    'pages', (
      select coalesce(jsonb_agg(t order by t.views desc), '[]'::jsonb)
      from (
        select
          v.path,
          count(*) as views,
          count(distinct v.visitor_id) as visitors
        from v
        group by v.path
        order by views desc
        limit 10
      ) t
    ),

    'people', (
      select coalesce(jsonb_agg(t order by t.last_seen desc), '[]'::jsonb)
      from (
        select
          v.user_id,
          p.full_name,
          p.avatar_url,
          count(*) as views,
          count(distinct v.local_ts::date) as days_active,
          min(v.local_ts) as first_seen,
          max(v.local_ts) as last_seen
        from v
        join public.profiles p on p.id = v.user_id
        group by v.user_id, p.full_name, p.avatar_url
      ) t
    ),

    -- מכשירים שבטווח הזה לא התחברו אף פעם
    'anonymous_visitors', (
      select count(*)
      from (
        select v.visitor_id
        from v
        group by v.visitor_id
        having bool_and(v.user_id is null)
      ) a
    )
  )
  into v_result;

  return v_result;
end;
$$;

revoke execute on function
  public.log_page_view(text, uuid),
  public.get_app_stats(int, boolean)
  from public;

grant execute on function public.log_page_view(text, uuid) to anon, authenticated;
grant execute on function public.get_app_stats(int, boolean) to authenticated;
