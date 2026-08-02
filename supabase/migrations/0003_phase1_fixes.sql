-- ─────────────────────────────────────────────────────────────
-- תיקוני שלב 1 אחרי סקירה מול המסמכים
-- ─────────────────────────────────────────────────────────────

-- arrive_at_station דורש שהמירוץ יהיה 'live', אבל complete_station לא —
-- כלומר אחרי finish_race קבוצה עדיין יכלה לסמן תחנה כהושלמה ולשנות את
-- הדירוג אחרי שהוכרזו הזוכים. אותה בדיקה, אותו מקום.
create or replace function public.complete_station(
  p_team_id uuid,
  p_secret_code text default null,
  p_proof_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_station public.stations;
  v_progress public.team_progress;
begin
  if not public.is_team_member(p_team_id) then
    raise exception 'אין הרשאה — לא חבר בקבוצה זו';
  end if;

  if not exists (
    select 1 from public.teams t
    join public.races r on r.id = t.race_id
    where t.id = p_team_id and r.status = 'live'
  ) then
    raise exception 'המירוץ לא פעיל';
  end if;

  select s.* into v_station
  from public.team_stations ts
  join public.stations s on s.id = ts.station_id
  left join public.team_progress tp
    on tp.team_id = ts.team_id and tp.station_id = ts.station_id
  where ts.team_id = p_team_id and tp.completed_at is null
  order by ts.position
  limit 1;

  if v_station.id is null then
    raise exception 'אין תחנה פעילה';
  end if;

  select * into v_progress from public.team_progress
  where team_id = p_team_id and station_id = v_station.id;

  if v_progress.arrived_at is null then
    raise exception 'עוד לא הגעתם לתחנה';
  end if;

  case v_station.completion_type
    when 'auto' then
      update public.team_progress set completed_at = now()
      where team_id = p_team_id and station_id = v_station.id;

    when 'secret_code' then
      if v_station.secret_code is null
         or upper(btrim(coalesce(p_secret_code, ''))) <> upper(btrim(v_station.secret_code)) then
        return jsonb_build_object('ok', false, 'error', 'הקוד לא נכון');
      end if;
      update public.team_progress set completed_at = now()
      where team_id = p_team_id and station_id = v_station.id;

    when 'photo_upload' then
      if coalesce(btrim(p_proof_url), '') = '' then
        return jsonb_build_object('ok', false, 'error', 'צריך להעלות תמונה');
      end if;
      update public.team_progress set completed_at = now(), proof_url = p_proof_url
      where team_id = p_team_id and station_id = v_station.id;

    when 'admin_approve' then
      update public.team_progress
      set approval_requested_at = now(), proof_url = coalesce(p_proof_url, proof_url)
      where team_id = p_team_id and station_id = v_station.id;
      return jsonb_build_object('ok', true, 'awaiting_approval', true);
    else
      raise exception 'סוג השלמה לא מוכר: %', v_station.completion_type;
  end case;

  return jsonb_build_object('ok', true, 'awaiting_approval', false);
end;
$$;

revoke execute on function public.complete_station(uuid, text, text) from public, anon;
grant execute on function public.complete_station(uuid, text, text) to authenticated;
