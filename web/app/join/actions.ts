"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type JoinFormState = { error?: string };

/**
 * שלב א' — קוד המשחק. רק מוודאים שיש מירוץ פתוח עם הקוד הזה;
 * ההצטרפות עצמה נעשית ב-join_race בשרת.
 */
export async function verifyGameCode(
  _prev: JoinFormState,
  formData: FormData
): Promise<JoinFormState> {
  const gameCode = String(formData.get("game_code") ?? "").trim();
  if (!/^\d{6}$/.test(gameCode)) {
    return { error: "קוד המשחק הוא 6 ספרות" };
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "צריך להתחבר קודם" };

  const { data: race } = await supabase
    .from("races")
    .select("id, status")
    .eq("game_code", gameCode)
    .in("status", ["open", "live"])
    .maybeSingle();

  if (!race) return { error: "לא נמצא משחק פתוח עם הקוד הזה" };

  redirect(`/join/team?code=${gameCode}`);
}

/** שלב ב' — קוד הקבוצה. יוצר בקשת הצטרפות שממתינה לאישור המנהל. */
export async function joinTeam(
  _prev: JoinFormState,
  formData: FormData
): Promise<JoinFormState> {
  const gameCode = String(formData.get("game_code") ?? "").trim();
  const teamCode = String(formData.get("team_code") ?? "").trim();
  if (!teamCode) return { error: "צריך להזין קוד קבוצה" };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "צריך להתחבר קודם" };

  const { error } = await supabase.rpc("join_race", {
    p_game_code: gameCode,
    p_team_code: teamCode,
  });

  if (error) return { error: error.message };

  redirect("/waiting");
}
