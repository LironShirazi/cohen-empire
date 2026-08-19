-- ─────────────────────────────────────────────────────────────
-- שלב 3 — העץ המשפחתי עובר מ-localStorage ל-Supabase
-- מקור: docs/06-family-tree.md §1, §4, docs/05 שלב 3
--
-- ⚠️ הטבלה `family_members` **כבר קיימת מ-0001** (docs/03) עם RLS
-- מופעל ומדיניות קריאה בלבד — כלומר עד היום היא ריקה ואי אפשר היה
-- לכתוב אליה כלל. המיגרציה הזו לא יוצרת אותה מחדש אלא משלימה את מה
-- שחסר כדי שהעץ יעבור לחיות בה: מעקב יוצר, מדיניות כתיבה, ההגנה על
-- "זה אני", מחיקה בטוחה, Realtime, bucket לתמונות והעץ ההתחלתי.
--
-- עד עכשיו העץ חי ב-localStorage — פר-דפדפן, וכל אחד ראה עץ אחר.
-- מכאן זה עץ **אחד** של המשפחה, וזו הסיבה שהכתיבה פתוחה לכל משתמש
-- מחובר: העץ שייך לכולם (docs/06 §4), ואין "בעלות" על ענף.
-- ─────────────────────────────────────────────────────────────

alter table public.family_members
  add column if not exists created_by uuid references public.profiles (id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

-- ─────────────────────────────────────────────────────────────
-- אילוצים שלא היו ב-0001
-- ─────────────────────────────────────────────────────────────

-- "זה אני": אדם אחד לא יכול להיות שני עלים, ועלה אחד לא שייך לשניים
create unique index if not exists family_members_profile_uniq
  on public.family_members (profile_id)
  where profile_id is not null;

alter table public.family_members
  drop constraint if exists family_members_no_self_reference;
alter table public.family_members
  add constraint family_members_no_self_reference check (
    id <> father_id and id <> mother_id and id <> partner_id
  );

alter table public.family_members
  drop constraint if exists family_members_name_len;
alter table public.family_members
  add constraint family_members_name_len
  check (length(btrim(name)) between 1 and 60);

alter table public.family_members
  drop constraint if exists family_members_gender_valid;
alter table public.family_members
  add constraint family_members_gender_valid check (gender in ('m', 'f'));

alter table public.family_members
  drop constraint if exists family_members_birth_year_valid;
alter table public.family_members
  add constraint family_members_birth_year_valid
  check (birth_year between 1800 and 2200);

-- ─────────────────────────────────────────────────────────────
-- ⚠️ **מחיקה נאכפת ב-FK, לא במדיניות.**
--
-- ב-0001 ההורות הייתה `on delete set null` — מחיקת סבא הייתה מנתקת
-- בשקט עשרה ילדים מההורים שלהם, והעץ היה נשבר בלי שאף אחד ישים לב.
-- docs/06 §1 מרשה למחוק **עלה ללא צאצאים בלבד**, ו-`restrict` אומר
-- בדיוק את זה — אטומית, בלי מרוץ בין בדיקה למחיקה. מדיניות RLS
-- שבודקת "אין ילדים" הייתה נכונה רק עד ה-INSERT הבא.
-- הקליינט מתרגם שגיאת 23503 להודעה בעברית.
--
-- `partner_id` נשאר `set null`: זוגיות מוסקת גם מהורות משותפת, אז
-- ניתוק בן זוג לא מאבד את מבנה העץ.
-- ─────────────────────────────────────────────────────────────
alter table public.family_members
  drop constraint if exists family_members_father_id_fkey;
alter table public.family_members
  add constraint family_members_father_id_fkey
  foreign key (father_id) references public.family_members (id) on delete restrict;

alter table public.family_members
  drop constraint if exists family_members_mother_id_fkey;
alter table public.family_members
  add constraint family_members_mother_id_fkey
  foreign key (mother_id) references public.family_members (id) on delete restrict;

-- Postgres לא מאנדקס מפתחות זרים לבד. `childrenOf`/`parentsOf` רצים
-- על כל רינדור של העץ, וה-restrict במחיקה סורק את אותן עמודות
create index if not exists family_members_father_idx
  on public.family_members (father_id);
create index if not exists family_members_mother_idx
  on public.family_members (mother_id);
create index if not exists family_members_partner_idx
  on public.family_members (partner_id);

create or replace function public.touch_family_member()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists family_members_touch on public.family_members;
create trigger family_members_touch
  before update on public.family_members
  for each row execute function public.touch_family_member();

-- ─────────────────────────────────────────────────────────────
-- RLS (docs/06 §4)
--
-- מדיניות הקריאה כבר קיימת מ-0001 (`family_members_read`, כל מחובר).
-- כאן נוספת הכתיבה — רחבה בכוונה: זה עץ של 40 איש שכולם מכירים זה
-- את זה, והחיכוך של "בקשת עריכה" היה הורג את הפיצ'ר. מה שכן מוגן
-- זה `profile_id` — ההצהרה "זה אני" שייכת רק לבעליה, אחרת אפשר היה
-- לשייך את עצמך לעלה של מישהו אחר או לנתק אותו משלו.
-- ─────────────────────────────────────────────────────────────
drop policy if exists family_members_insert on public.family_members;
create policy family_members_insert on public.family_members
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and (profile_id is null or profile_id = (select auth.uid()))
  );

-- **רק הזהות נעולה, לא העלה.** כל מחובר עורך כל עלה — שם, תמונה,
-- קשרים — כי בדיוק כך בונים עץ: דוד מוסיף בן זוג לשלמה, ושלמה לא
-- צריך להיות מחובר בשביל זה. `addPartner`/`addParents` בקוד מעדכנות
-- את השורה **הקיימת** (store.js:222,272), אז נעילת עלה תפוס הייתה
-- חוסמת בשקט בדיוק את העריכות הנפוצות ביותר.
--
-- מה שנשאר מוגן זה `profile_id` בלבד — וזה לא ניתן לביטוי במדיניות,
-- כי RLS לא רואה את הערך הישן. לכן זה טריגר (למטה).
drop policy if exists family_members_update on public.family_members;
create policy family_members_update on public.family_members
  for update to authenticated
  using (true)
  with check (true);

-- ─────────────────────────────────────────────────────────────
-- ההגנה על "זה אני"
--
-- מותר: לתפוס עלה פנוי לעצמי, ולשחרר את שלי. אסור: לקחת עלה
-- שמישהו אחר סימן, או לשייך עלה למשתמש אחר. מנהל-על עוקף (docs/06 §4).
-- שגיאה ולא "0 שורות" — כדי שהקליינט יוכל להסביר בעברית מה קרה.
-- ─────────────────────────────────────────────────────────────
create or replace function public.guard_family_member_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.profile_id is distinct from old.profile_id
     and not public.is_owner()
  then
    if not (
      (old.profile_id is null and new.profile_id = (select auth.uid()))
      or (old.profile_id = (select auth.uid()) and new.profile_id is null)
    ) then
      raise exception 'אפשר לסמן "זה אני" רק על עצמכם, ורק על עלה פנוי';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists family_members_guard_identity on public.family_members;
create trigger family_members_guard_identity
  before update on public.family_members
  for each row execute function public.guard_family_member_identity();

-- המחיקה עצמה מוגבלת ב-FK (restrict) — כאן רק מי רשאי לנסות
drop policy if exists family_members_delete on public.family_members;
create policy family_members_delete on public.family_members
  for delete to authenticated
  using (
    profile_id is null
    or profile_id = (select auth.uid())
    or public.is_owner()
  );

-- ─────────────────────────────────────────────────────────────
-- Realtime — "עדכון חי כשמישהו מוסיף עלה" (docs/06 §4).
-- ה-RLS למעלה חל גם על הערוץ; כאן הקריאה פתוחה לכל מחובר ממילא.
-- ─────────────────────────────────────────────────────────────
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'family_members'
     )
  then
    alter publication supabase_realtime add table public.family_members;
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────
-- Storage — תמונות העלים. אותה גישה כמו chat-files ו-station-media:
-- הקובץ קריא למי שיש לו הקישור, והקישור מגיע רק דרך שורה שה-RLS
-- למעלה חושף. התיקייה היא מזהה העלה.
--
-- עד היום התמונה נשמרה כ-dataURL בתוך ה-JSON (512px JPEG, ~50KB);
-- ב-bucket אין סיבה להיות קמצנים כל כך, אבל התקרה נשארת נמוכה כדי
-- שהעץ ייטען מהר בנייד גם עם מאות עלים.
-- ─────────────────────────────────────────────────────────────
do $$
begin
  if exists (select 1 from information_schema.tables
             where table_schema = 'storage' and table_name = 'objects') then

    insert into storage.buckets (id, name, public, file_size_limit)
    values ('family-tree', 'family-tree', true, 5242880)
    on conflict (id) do update
      set public = excluded.public,
          file_size_limit = excluded.file_size_limit;

    drop policy if exists family_tree_read on storage.objects;
    create policy family_tree_read on storage.objects for select
      using (bucket_id = 'family-tree');

    drop policy if exists family_tree_insert on storage.objects;
    create policy family_tree_insert on storage.objects for insert to authenticated
      with check (bucket_id = 'family-tree');

    -- מחיקה: מי שהעלה, או מנהל-על שמנקה. החלפת תמונה משאירה את
    -- הקובץ הישן — אותו חוב שכבר קיים ב-chat-files ובתחנות
    drop policy if exists family_tree_delete on storage.objects;
    create policy family_tree_delete on storage.objects for delete to authenticated
      using (
        bucket_id = 'family-tree'
        and (owner = (select auth.uid()) or public.is_owner())
      );
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────
-- העץ ההתחלתי (docs/06 §2) — מה שהיה עד היום ב-seedState() בקוד.
-- רץ פעם אחת בלבד: אם יש כבר עלים בטבלה לא נוגעים בכלום, כדי
-- שהרצה חוזרת של המיגרציה לא תשכפל את המשפחה.
-- `created_by` נשאר ריק — אלה לא עלים שמישהו יצר, זו נקודת הפתיחה.
-- ─────────────────────────────────────────────────────────────
do $$
declare
  v_saada uuid; v_mazhela uuid; v_khavita uuid; v_jula uuid;
  v_reuven uuid; v_traki uuid;
  v_seq int := 6;
  v_kid record;
begin
  if exists (select 1 from public.family_members) then
    return;
  end if;

  -- ההורים של סבא אורגני
  insert into public.family_members (name, gender, sort_order)
    values ('סבא סעדה', 'm', 0) returning id into v_saada;
  insert into public.family_members (name, gender, sort_order)
    values ('סבתא מז׳לה', 'f', 1) returning id into v_mazhela;
  update public.family_members set partner_id = v_mazhela where id = v_saada;
  update public.family_members set partner_id = v_saada where id = v_mazhela;

  -- ההורים של סבתא טראקי
  insert into public.family_members (name, gender, sort_order)
    values ('סבא חוויטה', 'm', 2) returning id into v_khavita;
  insert into public.family_members (name, gender, sort_order)
    values ('סבתא ג׳ולה', 'f', 3) returning id into v_jula;
  update public.family_members set partner_id = v_jula where id = v_khavita;
  update public.family_members set partner_id = v_khavita where id = v_jula;

  -- העיקר — טבעת זהב (docs/06 §2)
  insert into public.family_members (name, gender, father_id, mother_id, is_root, sort_order)
    values ('סבא אורגני ראובן', 'm', v_saada, v_mazhela, true, 4) returning id into v_reuven;
  insert into public.family_members (name, gender, father_id, mother_id, is_root, sort_order)
    values ('סבתא טראקי', 'f', v_khavita, v_jula, true, 5) returning id into v_traki;
  update public.family_members set partner_id = v_traki where id = v_reuven;
  update public.family_members set partner_id = v_reuven where id = v_traki;

  for v_kid in
    select * from (values
      ('שלמה', 'm'), ('יעל', 'f'), ('ציון', 'm'), ('רותי', 'f'),
      ('רוני', null::text), ('אילנה', 'f'), ('חיים', 'm'), ('סיגל', 'f'),
      ('אורי סלע', 'm'), ('נורית', 'f')
    ) as kids(name, gender)
  loop
    insert into public.family_members (name, gender, father_id, mother_id, sort_order)
      values (v_kid.name, v_kid.gender, v_reuven, v_traki, v_seq);
    v_seq := v_seq + 1;
  end loop;
end $$;
