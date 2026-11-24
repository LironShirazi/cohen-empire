import { sendNotification, setVapidDetails } from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * שליחת Push — צד שרת בלבד (CLAUDE.md §23). משותף לסטוריז
 * (`app/api/push/story`), לאזכורים (`app/api/push/chat`) ולהודעות רוחב
 * (`broadcastAction`).
 *
 * כל הקריאות כאן עם service role: המנויים של אחרים לא קריאים בשום
 * מדיניות, בכוונה. מי שקורא לפונקציות האלה אחראי לוודא קודם שהמשתמש
 * המחובר הוא באמת מי שיצר את האירוע.
 */

const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
const BATCH = 20;

export type PushPayload = { title: string; body: string; tag?: string; url: string };
type Sub = { endpoint: string; p256dh: string; auth: string };
type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

/** הלקוח, או `null` כש-Push לא מוגדר בסביבה הזו (ואז לא שולחים כלום) */
export function pushAdmin(): Admin | null {
  const admin = createAdminClient();
  if (!publicKey || !privateKey || !admin) return null;
  setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:admin@example.com", publicKey, privateKey);
  return admin;
}

/**
 * שולח לכל המנויים ברשימה. מנוי שהשירות מחזיר עליו 404/410 (הוסרה
 * ההתקנה, נמחקה ההרשאה) נמחק — אחרת היינו מנסים אותו לנצח.
 */
export async function sendToSubscriptions(
  admin: Admin,
  jobs: { sub: Sub; payload: PushPayload }[]
): Promise<{ sent: number; removed: number }> {
  const dead: string[] = [];
  let sent = 0;
  for (let i = 0; i < jobs.length; i += BATCH) {
    await Promise.all(
      jobs.slice(i, i + BATCH).map(async ({ sub, payload }) => {
        try {
          await sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            JSON.stringify(payload),
            { TTL: 60 * 60 * 24, urgency: "normal", timeout: 8000 }
          );
          sent++;
        } catch (e) {
          const status = (e as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) dead.push(sub.endpoint);
          else console.warn("push failed", status, (e as Error).message);
        }
      })
    );
  }
  if (dead.length) await admin.from("push_subscriptions").delete().in("endpoint", dead);
  return { sent, removed: dead.length };
}

/** תצוגה מקדימה של הודעה — שורה אחת, קצרה מספיק למסך נעול */
function preview(body: string | null): string {
  const text = (body ?? "").replace(/\s+/g, " ").trim();
  if (!text) return "צירף/ה קובץ";
  return text.length > 120 ? `${text.slice(0, 117)}…` : text;
}

/**
 * Push לכל ההתראות (אזכור / הודעת רוחב) שנוצרו מהודעות ש**המשתמש הזה**
 * שלח בדקות האחרונות ועוד לא נשלחו. ההתראות עצמן נוצרות בשרת (טריגר
 * האזכורים, `admin_broadcast`) — כאן רק מוסרים אותן הלאה, וזה מה
 * שמאפשר לא לסמוך על הקליינט: הוא לא אומר למי, רק "תבדוק אצלי".
 *
 * ⚠️ `notification_push_log` מבטיח שליחה אחת לכל התראה, ולכן קריאה
 * כפולה (או שתי הודעות ברצף) לא תכפיל כלום.
 */
export async function pushChatNotifications(senderId: string): Promise<{ sent: number }> {
  const admin = pushAdmin();
  if (!admin) return { sent: 0 };

  const since = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data: messages, error: messagesError } = await admin
    .from("messages")
    .select("id, team_id, body")
    .eq("sender_id", senderId)
    .gte("created_at", since);
  if (messagesError) {
    console.error("push chat: messages", messagesError.message);
    return { sent: 0 };
  }
  if (!messages?.length) return { sent: 0 };

  const { data: notes, error: notesError } = await admin
    .from("notifications")
    .select("id, user_id, type, race_id, team_id, message_id")
    .in("message_id", messages.map((m) => m.id))
    .in("type", ["mention", "admin_broadcast"]);
  if (notesError) {
    console.error("push chat: notifications", notesError.message);
    return { sent: 0 };
  }
  if (!notes?.length) return { sent: 0 };

  // תופסים את ההתראות לשליחה. מה שכבר ביומן חוזר ריק ומדולג
  const { data: claimed, error: claimError } = await admin
    .from("notification_push_log")
    .upsert(
      notes.map((n) => ({ notification_id: n.id })),
      { onConflict: "notification_id", ignoreDuplicates: true }
    )
    .select("notification_id");
  if (claimError) {
    console.error("push chat: log", claimError.message);
    return { sent: 0 };
  }
  const claimedIds = new Set((claimed ?? []).map((c) => c.notification_id as string));
  const fresh = notes.filter((n) => claimedIds.has(n.id));
  if (!fresh.length) return { sent: 0 };

  const recipients = [...new Set(fresh.map((n) => n.user_id as string))];
  const teamIds = [...new Set(fresh.map((n) => n.team_id as string))];
  const [{ data: subs }, { data: sender }, { data: memberships }, { data: teams }] =
    await Promise.all([
      admin
        .from("push_subscriptions")
        .select("endpoint, p256dh, auth, user_id")
        .in("user_id", recipients)
        .eq("notify_mentions", true),
      admin.from("profiles").select("full_name").eq("id", senderId).maybeSingle(),
      admin
        .from("team_members")
        .select("team_id, user_id")
        .in("team_id", teamIds)
        .in("user_id", recipients),
      admin.from("teams").select("id, name").in("id", teamIds),
    ]);
  if (!subs?.length) return { sent: 0 };

  const senderName = sender?.full_name?.trim() || "בן משפחה";
  const teamName = new Map((teams ?? []).map((t) => [t.id as string, t.name as string]));
  const isMember = new Set((memberships ?? []).map((m) => `${m.team_id}:${m.user_id}`));
  const bodyOf = new Map(messages.map((m) => [m.id as string, m.body as string | null]));

  const jobs: { sub: Sub; payload: PushPayload }[] = [];
  for (const n of fresh) {
    // אותו ניתוב כמו בבאנר (notification-center): משתתף ← הצ'אט שלו,
    // מנהל תורן שלא בקבוצה ← הצ'אט של הקבוצה במסך הניהול
    const url = isMember.has(`${n.team_id}:${n.user_id}`)
      ? `/team/chat#m-${n.message_id}`
      : `/admin/${n.race_id}/chat/${n.team_id}#m-${n.message_id}`;
    const payload: PushPayload =
      n.type === "admin_broadcast"
        ? { title: "הודעה מהמנהל", body: preview(bodyOf.get(n.message_id) ?? null), tag: `b-${n.message_id}`, url }
        : {
            title: `${senderName} הזכיר/ה אותך${teamName.get(n.team_id) ? ` · ${teamName.get(n.team_id)}` : ""}`,
            body: preview(bodyOf.get(n.message_id) ?? null),
            tag: `m-${n.message_id}`,
            url,
          };
    for (const sub of subs.filter((s) => s.user_id === n.user_id)) {
      jobs.push({ sub: sub as Sub, payload });
    }
  }

  const { sent } = await sendToSubscriptions(admin, jobs);
  return { sent };
}
