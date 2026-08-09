"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { FinishResult, Race, RaceStatus } from "@/lib/supabase/types";

export type AdminFormState = { error?: string };

/**
 * כל הפעולות כאן נשענות על הרשאה בצד השרת:
 * או פונקציית RPC שבודקת is_race_admin, או RLS על הטבלה עצמה.
 * שום בדיקה כאן היא לא ההגנה — היא רק כדי להחזיר שגיאה יפה בעברית.
 */

export async function createRaceAction(
  _prev: AdminFormState,
  formData: FormData
): Promise<AdminFormState> {
  const year = Number(formData.get("year"));
  const name = String(formData.get("name") ?? "").trim();
  const startsAt = String(formData.get("starts_at") ?? "");
  const lat = formData.get("start_lat");
  const lng = formData.get("start_lng");

  if (!Number.isInteger(year)) return { error: "שנה לא תקינה" };
  if (!name) return { error: "צריך שם למירוץ" };
  if (!startsAt) return { error: "צריך תאריך ושעת זינוק" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_race", {
    p_year: year,
    p_name: name,
    p_starts_at: new Date(startsAt).toISOString(),
    p_start_lat: lat ? Number(lat) : null,
    p_start_lng: lng ? Number(lng) : null,
  });

  if (error) return { error: error.message };

  redirect(`/admin/${(data as Race).id}`);
}

export async function setRaceStatusAction(raceId: string, status: RaceStatus) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_race_status", {
    p_race_id: raceId,
    p_status: status,
  });
  if (error) return { error: error.message };
  refresh();
  return {};
}

/** מינוי מנהל תורן נוסף למירוץ (docs/01-requirements.md §2) */
export async function addRaceAdminAction(raceId: string, userId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_race_admin", {
    p_race_id: raceId,
    p_user_id: userId,
  });
  if (error) return { error: error.message };
  refresh();
  return {};
}

export async function decideJoinRequestAction(
  requestId: string,
  approve: boolean
) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("decide_join_request", {
    p_request_id: requestId,
    p_approve: approve,
  });
  if (error) return { error: error.message };
  refresh();
  return {};
}

// ── קבוצות ───────────────────────────────────────────────────

export async function saveTeamAction(
  raceId: string,
  _prev: AdminFormState,
  formData: FormData
): Promise<AdminFormState> {
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const color = String(formData.get("color") ?? "").trim();
  const animal = String(formData.get("animal") ?? "").trim();
  const joinCode = String(formData.get("join_code") ?? "").trim();

  if (!name) return { error: "צריך שם לקבוצה" };
  if (!/^\d{1,2}$/.test(joinCode)) return { error: "קוד קבוצה הוא ספרה או שתיים" };

  const supabase = await createClient();
  const values = { race_id: raceId, name, color, animal: animal || null, join_code: joinCode };

  const { error } = id
    ? await supabase.from("teams").update(values).eq("id", id)
    : await supabase.from("teams").insert(values);

  if (error) {
    return {
      error: error.code === "23505" ? "קוד הקבוצה כבר תפוס במירוץ הזה" : error.message,
    };
  }

  refresh();
  return {};
}

export async function deleteTeamAction(teamId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("teams").delete().eq("id", teamId);
  if (error) return { error: error.message };
  refresh();
  return {};
}

// ── תחנות ────────────────────────────────────────────────────

export async function saveStationAction(
  raceId: string,
  _prev: AdminFormState,
  formData: FormData
): Promise<AdminFormState> {
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const clue = String(formData.get("clue") ?? "").trim();
  const taskText = String(formData.get("task_text") ?? "").trim();
  const taskMedia = String(formData.get("task_media") ?? "").trim();
  const backstory = String(formData.get("backstory") ?? "").trim();
  const lat = Number(formData.get("lat"));
  const lng = Number(formData.get("lng"));
  const radius = Number(formData.get("radius_m"));
  const completionType = String(formData.get("completion_type") ?? "admin_approve");
  const secretCode = String(formData.get("secret_code") ?? "").trim();

  if (!name) return { error: "צריך שם לתחנה" };
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { error: "צריך לבחור מיקום על המפה" };
  }
  if (!Number.isFinite(radius) || radius < 10) {
    return { error: "רדיוס הנעילה חייב להיות לפחות 10 מטר" };
  }
  if (completionType === "secret_code" && !secretCode) {
    return { error: "תחנה עם קוד סודי חייבת קוד" };
  }

  const supabase = await createClient();
  const values = {
    race_id: raceId,
    name,
    backstory: backstory || null,
    clue: clue || null,
    // jsonb {text, media} לפי docs/03 — null רק אם אין לא טקסט ולא מדיה
    task_content:
      taskText || taskMedia
        ? { text: taskText, media: taskMedia || null }
        : null,
    lat,
    lng,
    radius_m: Math.round(radius),
    completion_type: completionType,
    secret_code: completionType === "secret_code" ? secretCode : null,
  };

  const { error } = id
    ? await supabase.from("stations").update(values).eq("id", id)
    : await supabase.from("stations").insert(values);

  if (error) return { error: error.message };

  refresh();
  return {};
}

export async function deleteStationAction(stationId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("stations").delete().eq("id", stationId);
  if (error) return { error: error.message };
  refresh();
  return {};
}

/** סדר תחנות: זהה לכולם או אקראי לכל קבוצה (docs/01 §4) */
export async function assignStationOrderAction(raceId: string, mode: "same" | "random") {
  const supabase = await createClient();
  const { error } = await supabase.rpc("assign_station_order", {
    p_race_id: raceId,
    p_mode: mode,
  });
  if (error) return { error: error.message };
  refresh();
  return {};
}

export async function setTeamStationOrderAction(
  teamId: string,
  stationIds: string[]
) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_team_station_order", {
    p_team_id: teamId,
    p_station_ids: stationIds,
  });
  if (error) return { error: error.message };
  refresh();
  return {};
}

// ── ניהול חי ─────────────────────────────────────────────────

export async function adminOpenStationAction(teamId: string, stationId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_open_station", {
    p_team_id: teamId,
    p_station_id: stationId,
  });
  if (error) return { error: error.message };
  refresh();
  return {};
}

export async function adminDecideStationAction(
  teamId: string,
  stationId: string,
  approve: boolean
) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_decide_station", {
    p_team_id: teamId,
    p_station_id: stationId,
    p_approve: approve,
  });
  if (error) return { error: error.message };
  refresh();
  return {};
}

export async function finishRaceAction(
  raceId: string
): Promise<{ error?: string; winner?: FinishResult["winner"] }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("finish_race", { p_race_id: raceId });
  if (error) return { error: error.message };
  refresh();
  return { winner: (data as FinishResult).winner };
}

export async function archiveRaceAction(raceId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("archive_race", { p_race_id: raceId });
  if (error) return { error: error.message };
  refresh();
  return {};
}
