"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ArriveResult, CompleteResult } from "@/lib/supabase/types";

/**
 * "הגענו!" — הקליינט שולח את המיקום שלו, והשרת מחשב את המרחק מחדש
 * ומחליט. הבדיקה בקליינט היא רק כדי לא להציף בקריאות; היא לא קובעת.
 */
export async function arriveAction(
  teamId: string,
  lat: number,
  lng: number,
  accuracy: number | null
): Promise<ArriveResult & { error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("arrive_at_station", {
    p_team_id: teamId,
    p_lat: lat,
    p_lng: lng,
    p_accuracy_m: accuracy,
  });

  if (error) return { arrived: false, distance_m: 0, error: error.message };

  const result = data as ArriveResult;
  if (result.arrived) refresh();
  return result;
}

export async function completeAction(
  teamId: string,
  secretCode: string | null,
  proofUrl: string | null
): Promise<CompleteResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("complete_station", {
    p_team_id: teamId,
    p_secret_code: secretCode,
    p_proof_url: proofUrl,
  });

  if (error) return { ok: false, error: error.message };

  const result = data as CompleteResult;
  if (result.ok) refresh();
  return result;
}
