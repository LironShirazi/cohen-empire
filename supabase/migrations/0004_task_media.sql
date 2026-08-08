-- ─────────────────────────────────────────────────────────────
-- מדיה במשימה — task_content הופך לאובייקט {text, media}
--
-- docs/01 §4 ו-docs/04 §3 מדברים על משימה עם טקסט/תמונה/וידאו,
-- ו-docs/03 ממדל את task_content כ-jsonb ("טקסט + מדיה"). העמודה
-- כבר jsonb מ-0001, אבל שלב 1 כתב לתוכה מחרוזת JSON חשופה. כאן
-- מיישרים את הנתונים הקיימים לצורה שהמסמך מתאר.
-- ─────────────────────────────────────────────────────────────

-- מחרוזת קיימת → {"text": "…", "media": null}. שורות שכבר אובייקט
-- (הרצה חוזרת של המיגרציה) נשארות כמו שהן.
update public.stations
set task_content = jsonb_build_object('text', task_content #>> '{}', 'media', null)
where task_content is not null
  and jsonb_typeof(task_content) = 'string';

-- מחרוזת ריקה שנשמרה בטעות שקולה ל"אין משימה"
update public.stations
set task_content = null
where task_content is not null
  and jsonb_typeof(task_content) = 'object'
  and coalesce(task_content ->> 'text', '') = ''
  and task_content ->> 'media' is null;

-- מכאן והלאה רק הצורה החדשה נכנסת: אובייקט עם text (מחרוזת חובה) ו-media
-- (URL או null/חסר). מונע חזרה שקטה למחרוזת אם מישהו כותב ישירות ב-SQL
-- editor. שימו לב ל-coalesce: מפתח חסר מחזיר NULL מ-jsonb_typeof, ובדיקת
-- check עם NULL *עוברת* — בלעדיו {"media": "x"} בלי text היה מתקבל.
alter table public.stations
  drop constraint if exists stations_task_content_shape;

alter table public.stations
  add constraint stations_task_content_shape check (
    task_content is null
    or (
      jsonb_typeof(task_content) = 'object'
      and coalesce(jsonb_typeof(task_content -> 'text'), 'missing') = 'string'
      and coalesce(jsonb_typeof(task_content -> 'media'), 'null')
          in ('string', 'null')
    )
  );

-- ─────────────────────────────────────────────────────────────
-- Storage — מדיה של משימות שהמנהל מעלה מראש.
-- הקובץ עצמו קריא לכל מי שיש לו הקישור, כמו bucket ה-proofs: את
-- הקישור מקבלים רק דרך get_team_state, שמחזיר task_content אך ורק
-- אחרי שהשרת אימת הגעה לרדיוס. העלאה/מחיקה — למנהלי המירוץ בלבד,
-- ורק לתיקייה שנושאת את מזהה המירוץ שלהם.
-- ─────────────────────────────────────────────────────────────
do $$
begin
  if exists (select 1 from information_schema.tables
             where table_schema = 'storage' and table_name = 'objects') then

    insert into storage.buckets (id, name, public)
    values ('station-media', 'station-media', true)
    on conflict (id) do nothing;

    drop policy if exists station_media_read on storage.objects;
    create policy station_media_read on storage.objects for select
      using (bucket_id = 'station-media');

    drop policy if exists station_media_insert on storage.objects;
    create policy station_media_insert on storage.objects for insert to authenticated
      with check (
        bucket_id = 'station-media'
        and public.is_race_admin(((storage.foldername(name))[1])::uuid)
      );

    drop policy if exists station_media_update on storage.objects;
    create policy station_media_update on storage.objects for update to authenticated
      using (
        bucket_id = 'station-media'
        and public.is_race_admin(((storage.foldername(name))[1])::uuid)
      );

    drop policy if exists station_media_delete on storage.objects;
    create policy station_media_delete on storage.objects for delete to authenticated
      using (
        bucket_id = 'station-media'
        and public.is_race_admin(((storage.foldername(name))[1])::uuid)
      );
  end if;
end;
$$;
