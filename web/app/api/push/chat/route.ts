import { NextResponse } from "next/server";
import { getUser } from "@/lib/data";
import { pushChatNotifications } from "@/lib/push-server";

/**
 * Push לאזכורים (CLAUDE.md §23). הצ'אט קורא לכאן אחרי הודעה עם אזכור.
 *
 * ⚠️ הגוף ריק בכוונה: הקליינט לא אומר למי לשלוח ולא על איזו הודעה.
 * השרת מחפש בעצמו התראות שנוצרו (בטריגר האזכורים) מהודעות **של
 * המשתמש המחובר** בדקות האחרונות — כך אי אפשר לעורר Push בשם מישהו אחר.
 */
export async function POST() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const result = await pushChatNotifications(user.id);
  return NextResponse.json(result);
}
