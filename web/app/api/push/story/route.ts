import { NextResponse } from "next/server";
import { getUser } from "@/lib/data";
import { pushAdmin, sendToSubscriptions } from "@/lib/push-server";
import { shortName } from "@/lib/stories";
import { createClient } from "@/lib/supabase/server";

/**
 * שולח Push לכל המשפחה כשעלה סטורי (CLAUDE.md §23).
 *
 * הקליינט קורא לכאן אחרי ה-insert. **לא סומכים עליו**: הסטורי נקרא
 * מחדש בשם המשתמש (RLS), ורק מי שהעלה אותו, ורק בדקות הראשונות, יכול
 * לעורר שליחה. ה-`story_push_log` מבטיח שליחה אחת לכל סטורי.
 */
const FRESH_MS = 10 * 60 * 1000;

export async function POST(request: Request) {
  const admin = pushAdmin();
  if (!admin) {
    // Push לא מוגדר בסביבה הזו — לא שגיאה, האפליקציה עובדת בלעדיו
    return NextResponse.json({ sent: 0, reason: "not-configured" });
  }

  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { storyId?: unknown } | null;
  const storyId = typeof body?.storyId === "string" ? body.storyId : null;
  if (!storyId) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const supabase = await createClient();
  const { data: story } = await supabase
    .from("stories")
    .select("id, user_id, created_at")
    .eq("id", storyId)
    .maybeSingle();
  if (
    !story ||
    story.user_id !== user.id ||
    Date.now() - new Date(story.created_at).getTime() > FRESH_MS
  ) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // שליחה אחת לסטורי: הכשל על המפתח הראשי הוא "כבר נשלח"
  const { error: logError } = await admin.from("story_push_log").insert({ story_id: storyId });
  if (logError) {
    if (logError.code === "23505") return NextResponse.json({ sent: 0, reason: "duplicate" });
    console.error("story_push_log", logError.message);
    return NextResponse.json({ error: "log failed" }, { status: 500 });
  }

  // אותו שם כמו בפס הסטוריז: מהעץ, ואם אין — מפרופיל ה-Google
  const [{ data: leaf }, { data: profile }, { data: subs, error: subsError }] = await Promise.all([
    admin.from("family_members").select("name").eq("profile_id", user.id).maybeSingle(),
    admin.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    admin
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .neq("user_id", user.id)
      .eq("notify_stories", true),
  ]);
  if (subsError) {
    console.error("push_subscriptions", subsError.message);
    return NextResponse.json({ error: "subscriptions failed" }, { status: 500 });
  }

  const name = shortName(leaf?.name || profile?.full_name || "") || "מישהו מהמשפחה";
  // ⚠️ "שיתף/ה" כי המגדר לא ידוע; ובלי תוכן הסטורי — ההתראה מופיעה על מסך נעול
  const payload = {
    title: "סטורי חדש",
    body: `${name} שיתף/ה סטורי`,
    tag: `story-${user.id}`,
    url: "/",
  };

  const result = await sendToSubscriptions(
    admin,
    (subs ?? []).map((sub) => ({ sub, payload }))
  );
  return NextResponse.json(result);
}
