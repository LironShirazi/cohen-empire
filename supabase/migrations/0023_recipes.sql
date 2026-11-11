-- ─────────────────────────────────────────────────────────────
-- ספר המתכונים המשפחתי (סבב 7 בסקיצות)
--
-- מתכון הוא טקסט — שם, של מי, מנות, רכיבים ושלבים בשורה אחת, 1–2KB.
-- התמונות (ראשית + ממוזערת לרשימה + אחת לכל היותר לכל שלב) מוקטנות
-- בטלפון ויושבות ב-bucket `recipes`, לא בטבלה.
--
-- ⚠️ "של מי המתכון" (`owner_name`) הוא **טקסט חופשי** ולא הפניה לעץ או
-- לפרופיל: המתכון של סבתא טראקי ז"ל מוזן ע"י הנכדה, ולסבתא אין חשבון.
-- מי שהוסיף נשמר בנפרד (`created_by`) — זה מה שמופיע בקטן "הוסיפה: יעל".
--
-- הרשאות: כל בן משפחה מחובר קורא ומוסיף. עריכה ומחיקה — מי שהוסיף
-- ומנהל-על (בשונה מאלבום בגלריה: מתכון הוא הנוסח של מישהו, לא מאגר משותף).
-- ─────────────────────────────────────────────────────────────

create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_name text not null,
  servings int not null default 4,
  -- ["2 כוסות סולת", "מלח"]
  ingredients jsonb not null default '[]'::jsonb,
  -- [{"text": "...", "image_url": "https://..." | null}]
  steps jsonb not null default '[]'::jsonb,
  photo_url text not null,
  thumb_url text,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),

  constraint recipes_name_len check (length(btrim(name)) between 1 and 80),
  constraint recipes_owner_len check (length(btrim(owner_name)) between 1 and 60),
  constraint recipes_servings_range check (servings between 1 and 99),
  constraint recipes_ingredients_array check (
    jsonb_typeof(ingredients) = 'array' and jsonb_array_length(ingredients) <= 60
  ),
  constraint recipes_steps_array check (
    jsonb_typeof(steps) = 'array' and jsonb_array_length(steps) between 1 and 40
  )
);

create index if not exists recipes_created_at_idx on public.recipes (created_at desc);
create index if not exists recipes_created_by_idx on public.recipes (created_by);

alter table public.recipes enable row level security;

drop policy if exists recipes_read on public.recipes;
create policy recipes_read on public.recipes for select to authenticated
  using (true);

-- `created_by` הוא תמיד הכותב — אחרת אפשר להוסיף מתכון "בשם" מישהו אחר
drop policy if exists recipes_insert on public.recipes;
create policy recipes_insert on public.recipes for insert to authenticated
  with check (created_by = (select auth.uid()));

drop policy if exists recipes_delete on public.recipes;
create policy recipes_delete on public.recipes for delete to authenticated
  using (created_by = (select auth.uid()) or public.is_owner());

drop policy if exists recipes_update on public.recipes;
create policy recipes_update on public.recipes for update to authenticated
  using (created_by = (select auth.uid()) or public.is_owner())
  with check (created_by = (select auth.uid()) or public.is_owner());

-- ⚠️ הרשאה ברמת העמודה (כמו בגלריה, CLAUDE.md §10): RLS מחליט על
-- אילו שורות, לא על אילו עמודות. בלי זה עריכה הייתה יכולה גם להחליף
-- את `created_by` ולהעביר את המתכון למישהו אחר
revoke update on public.recipes from authenticated;
grant update (name, owner_name, servings, ingredients, steps, photo_url, thumb_url)
  on public.recipes to authenticated;

-- ─────────────────────────────────────────────────────────────
-- שאלות על מתכון
--
-- שאלה עד 200 תווים, ותשובה אחת. מי שעונה הוא מי שהוסיף את המתכון
-- (או מנהל-על) — דרך `answer_recipe_question`, כי בעמודה אחת יושבות גם
-- השאלה של אחד וגם התשובה של אחר, ו-RLS לא מבחין בין עמודות.
-- ─────────────────────────────────────────────────────────────

create table if not exists public.recipe_questions (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  asked_by uuid default auth.uid() references public.profiles (id) on delete set null,
  text text not null,
  answer text,
  answered_by uuid references public.profiles (id) on delete set null,
  answered_at timestamptz,
  created_at timestamptz not null default now(),

  constraint recipe_questions_text_len check (length(btrim(text)) between 1 and 200),
  constraint recipe_questions_answer_len check (
    answer is null or length(btrim(answer)) between 1 and 400
  )
);

create index if not exists recipe_questions_recipe_idx
  on public.recipe_questions (recipe_id, created_at);

alter table public.recipe_questions enable row level security;

drop policy if exists recipe_questions_read on public.recipe_questions;
create policy recipe_questions_read on public.recipe_questions for select to authenticated
  using (true);

-- שאלה חדשה תמיד בלי תשובה — התשובה נכתבת רק ב-RPC
drop policy if exists recipe_questions_insert on public.recipe_questions;
create policy recipe_questions_insert on public.recipe_questions for insert to authenticated
  with check (
    asked_by = (select auth.uid())
    and answer is null and answered_by is null and answered_at is null
  );

drop policy if exists recipe_questions_delete on public.recipe_questions;
create policy recipe_questions_delete on public.recipe_questions for delete to authenticated
  using (asked_by = (select auth.uid()) or public.is_owner());

revoke update on public.recipe_questions from authenticated;

create or replace function public.answer_recipe_question(p_question_id uuid, p_answer text)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  v_recipe_owner uuid;
begin
  select r.created_by into v_recipe_owner
  from public.recipe_questions q
  join public.recipes r on r.id = q.recipe_id
  where q.id = p_question_id;

  if not found then
    raise exception 'question not found' using errcode = 'P0002';
  end if;

  if v_recipe_owner is distinct from (select auth.uid()) and not public.is_owner() then
    raise exception 'only the recipe author can answer' using errcode = '42501';
  end if;

  update public.recipe_questions
  set answer = nullif(btrim(p_answer), ''),
      answered_by = case when nullif(btrim(p_answer), '') is null then null else (select auth.uid()) end,
      answered_at = case when nullif(btrim(p_answer), '') is null then null else now() end
  where id = p_question_id;
end;
$$;

revoke execute on function public.answer_recipe_question(uuid, text) from public, anon;
grant execute on function public.answer_recipe_question(uuid, text) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- Storage: bucket `recipes`
--
-- 10MB כמו `family-content` — תמונות בלבד, אחרי הקטנה בטלפון.
-- כל אחד מעלה רק לתיקייה ששמה המזהה שלו, ומוחק רק ממנה (ומנהל-על הכל).
-- ─────────────────────────────────────────────────────────────

do $$
begin
  if exists (select 1 from information_schema.tables
             where table_schema = 'storage' and table_name = 'objects') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('recipes', 'recipes', true, 10485760,
            array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'])
    on conflict (id) do update
      set public = excluded.public,
          file_size_limit = excluded.file_size_limit,
          allowed_mime_types = excluded.allowed_mime_types;

    drop policy if exists recipes_files_read on storage.objects;
    create policy recipes_files_read on storage.objects for select
      using (bucket_id = 'recipes');

    drop policy if exists recipes_files_insert on storage.objects;
    create policy recipes_files_insert on storage.objects for insert to authenticated
      with check (
        bucket_id = 'recipes'
        and (storage.foldername(name))[1] = (select auth.uid())::text
      );

    drop policy if exists recipes_files_delete on storage.objects;
    create policy recipes_files_delete on storage.objects for delete to authenticated
      using (
        bucket_id = 'recipes'
        and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_owner())
      );
  end if;
end $$;
