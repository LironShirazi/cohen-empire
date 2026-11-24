-- ─────────────────────────────────────────────────────────────
-- התראות Push (PWA): מנויים + יומן שליחה
--
-- מנוי = מכשיר אחד של משתמש אחד (`endpoint` ייחודי לכל דפדפן/מכשיר).
-- קיום השורה הוא ההסכמה: כיבוי התראות מוחק אותה.
--
-- ⚠️ השליחה עצמה לא כאן — היא ב-`app/api/push/story/route.ts`, עם
-- מפתח ה-VAPID הפרטי ו-service role. הקליינט רשאי רק לנהל את המנויים
-- של עצמו; הוא לעולם לא קורא את המנויים של אחרים.
-- ─────────────────────────────────────────────────────────────

create table if not exists public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists push_subscriptions_read on public.push_subscriptions;
create policy push_subscriptions_read on public.push_subscriptions for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists push_subscriptions_delete on public.push_subscriptions;
create policy push_subscriptions_delete on public.push_subscriptions for delete to authenticated
  using (user_id = (select auth.uid()));

-- אין INSERT/UPDATE ישיר: ראו `save_push_subscription`
revoke insert, update on public.push_subscriptions from authenticated;

-- ⚠️ למה RPC ולא upsert: אותו מכשיר יכול להתחבר עם משתמש אחר (טלפון
-- משפחתי משותף). ה-endpoint הוא המפתח הראשי, ולכן המנוי של המשתמש
-- הקודם צריך לעבור לנוכחי — ו-RLS לא נותן למשתמש החדש לעדכן שורה שאינה שלו.
-- `security definer` + `auth.uid()` מבטיח שאי אפשר לרשום מנוי על שם אחר.
create or replace function public.save_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text default null
)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  insert into public.push_subscriptions (endpoint, user_id, p256dh, auth, user_agent)
  values (p_endpoint, (select auth.uid()), p_p256dh, p_auth, left(p_user_agent, 300))
  on conflict (endpoint) do update
    set user_id = excluded.user_id,
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        user_agent = excluded.user_agent;
end;
$$;

revoke execute on function public.save_push_subscription(text, text, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text, text) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- יומן שליחה — מונע כפילות: הקליינט קורא לשרת אחרי כל סטורי, ושתי
-- קריאות על אותו סטורי (ניסיון חוזר, לחיצה כפולה) לא ישלחו פעמיים.
-- הכתיבה רק מה-route (service role), ולכן אין מדיניות ואין grant.
-- ─────────────────────────────────────────────────────────────

create table if not exists public.story_push_log (
  story_id uuid primary key references public.stories (id) on delete cascade,
  sent_at timestamptz not null default now()
);

alter table public.story_push_log enable row level security;
