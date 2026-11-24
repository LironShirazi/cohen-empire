-- ─────────────────────────────────────────────────────────────
-- Push לאזכורים (@) ולהודעות רוחב (📣), והעדפות לכל מכשיר
--
-- עד כאן קיום המנוי היה ההסכמה, ו-Push נשלח רק על סטוריז. עכשיו לכל
-- מכשיר שני מתגים נפרדים. **ברירת המחדל של שניהם היא דלוק** — כך
-- מנויים קיימים (שהפעילו סטוריז) מקבלים גם אזכורים בלי לעשות כלום,
-- ומי שמפעיל עכשיו את אחד מהם מקבל את האזכורים כברירת מחדל.
-- ─────────────────────────────────────────────────────────────

alter table public.push_subscriptions
  add column if not exists notify_stories boolean not null default true,
  add column if not exists notify_mentions boolean not null default true;

-- החתימה משתנה (העדפות אופציונליות) — מוחקים את הישנה כדי שלא יהיו
-- שתי גרסאות והקריאה תהיה דו-משמעית
drop function if exists public.save_push_subscription(text, text, text, text);

-- `null` בהעדפה = להשאיר כמו שהיא (בשורה חדשה: דלוק). כך הסנכרון בכל
-- כניסה לא דורס את מה שהמשתמש בחר.
create or replace function public.save_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text default null,
  p_stories boolean default null,
  p_mentions boolean default null
)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  insert into public.push_subscriptions
    (endpoint, user_id, p256dh, auth, user_agent, notify_stories, notify_mentions)
  values
    (p_endpoint, (select auth.uid()), p_p256dh, p_auth, left(p_user_agent, 300),
     coalesce(p_stories, true), coalesce(p_mentions, true))
  on conflict (endpoint) do update
    set user_id = excluded.user_id,
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        user_agent = excluded.user_agent,
        notify_stories = coalesce(p_stories, public.push_subscriptions.notify_stories),
        notify_mentions = coalesce(p_mentions, public.push_subscriptions.notify_mentions);
end;
$$;

revoke execute on function public.save_push_subscription(text, text, text, text, boolean, boolean)
  from public, anon;
grant execute on function public.save_push_subscription(text, text, text, text, boolean, boolean)
  to authenticated;

-- ─────────────────────────────────────────────────────────────
-- יומן שליחה להתראות צ'אט — כמו `story_push_log`: שליחה אחת לכל שורת
-- `notifications`, גם אם השרת נקרא פעמיים. נכתב רק מ-service role.
-- ─────────────────────────────────────────────────────────────

create table if not exists public.notification_push_log (
  notification_id uuid primary key references public.notifications (id) on delete cascade,
  sent_at timestamptz not null default now()
);

alter table public.notification_push_log enable row level security;
