-- ─────────────────────────────────────────────────────────────
-- אנליטיקה — רשימת הביקורים בלי התחברות
--
-- 0020 ספר מכשירים שלא התחברו (`anonymous_visitors`) אבל לא הראה מה
-- כל אחד מהם עשה. כאן `get_app_stats` מחזירה גם `anonymous`: לכל
-- מכשיר כזה — מתי הגיע, כמה פעמים, ולאילו מסכים. אותה הרשאה
-- (`is_owner()` בלבד), אותו סינון מנהלי-על, אותו שעון ירושלים.
--
-- ⚠️ **50 המכשירים האחרונים בלבד.** הספירה המלאה נשארת ב-
-- `anonymous_visitors`; הרשימה היא לעיון, לא דוח.
--
-- החתימה לא השתנתה, ולכן `create or replace` מספיק וה-grant של 0020
-- נשאר בתוקף.
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
    ),

    -- אותם מכשירים, כל אחד לחוד (0021). `device` הוא 4 התווים
    -- הראשונים של המזהה — יציב בין טווחים, ולא חושף את המזהה כולו
    'anonymous', (
      select coalesce(jsonb_agg(t order by t.last_seen desc), '[]'::jsonb)
      from (
        select
          left(v.visitor_id::text, 4) as device,
          count(*) as views,
          count(distinct v.local_ts::date) as days_active,
          min(v.local_ts) as first_seen,
          max(v.local_ts) as last_seen,
          -- המסכים לפי סדר הביקור הראשון בכל אחד
          (
            select jsonb_agg(f.path order by f.first_at)
            from (
              select v2.path, min(v2.local_ts) as first_at
              from v v2
              where v2.visitor_id = v.visitor_id
              group by v2.path
            ) f
          ) as pages
        from v
        group by v.visitor_id
        having bool_and(v.user_id is null)
        order by max(v.local_ts) desc
        limit 50
      ) t
    )
  )
  into v_result;

  return v_result;
end;
$$;
