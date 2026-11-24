/**
 * התראות Push — צד הדפדפן (CLAUDE.md §23).
 *
 * הזרימה: Service Worker (`public/sw.js`) ← הרשאה ← `pushManager.subscribe`
 * ← שמירת המנוי ב-`save_push_subscription` (0028). השליחה בשרת.
 */
import { createClient } from "@/lib/supabase/client";

export const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

/** מצב המכשיר הזה, בצורה שהממשק צריך לבחור מה להציג */
export type PushSupport =
  | "unsupported" // הדפדפן לא יודע Push בכלל
  | "needs-install" // iOS: Push עובד רק מאפליקציה שהותקנה למסך הבית
  | "denied" // המשתמש חסם בהגדרות הדפדפן — אי אפשר לבקש שוב
  | "ready"; // אפשר לבקש הרשאה / כבר ניתנה

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari — לפני שתמך ב-display-mode
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  // iPadOS 13+ מזדהה כ-Macintosh; מזהים לפי מגע
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export function pushSupport(): PushSupport {
  if (typeof window === "undefined" || !VAPID_PUBLIC_KEY) return "unsupported";
  const hasApis =
    "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (!hasApis) return isIos() && !isStandalone() ? "needs-install" : "unsupported";
  if (Notification.permission === "denied") return "denied";
  return "ready";
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function registration(): Promise<ServiceWorkerRegistration> {
  // `updateViaCache: none` — שינוי ב-sw.js צריך להגיע, לא להיתקע בקאש
  await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
  return navigator.serviceWorker.ready;
}

/** המנוי של המכשיר הזה, אם יש (בלי לבקש הרשאה) */
export async function currentSubscription(): Promise<PushSubscription | null> {
  if (pushSupport() === "unsupported" || pushSupport() === "needs-install") return null;
  const reg = await registration();
  return reg.pushManager.getSubscription();
}

async function saveToServer(sub: PushSubscription): Promise<void> {
  const json = sub.toJSON();
  const { error } = await createClient().rpc("save_push_subscription", {
    p_endpoint: sub.endpoint,
    p_p256dh: json.keys?.p256dh ?? "",
    p_auth: json.keys?.auth ?? "",
    p_user_agent: navigator.userAgent,
  });
  if (error) throw error;
}

/**
 * מבקש הרשאה ומנוי. ⚠️ חייב להיקרא ישירות מתוך לחיצה — ב-iOS בקשת
 * הרשאה שלא מגיעה ממחווה של המשתמש נדחית בשקט.
 */
export async function enablePush(): Promise<"enabled" | "denied"> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "denied";
  const reg = await registration();
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    }));
  await saveToServer(sub);
  return "enabled";
}

export async function disablePush(): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) return;
  await createClient().from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
  await sub.unsubscribe();
}

/**
 * מיישר קו בכל כניסה: אם ההרשאה כבר ניתנה, המנוי נשמר שוב על המשתמש
 * המחובר עכשיו (מכשיר משותף) ונרענן אם הדפדפן החליף אותו.
 */
export async function syncPushSubscription(): Promise<void> {
  if (pushSupport() !== "ready" || Notification.permission !== "granted") return;
  const sub = await currentSubscription();
  if (sub) await saveToServer(sub);
}

/** מודיע לשרת שעלה סטורי — הוא זה ששולח. כשל כאן לא צריך לעצור כלום */
export function notifyStoryPosted(storyId: string): void {
  void fetch("/api/push/story", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ storyId }),
    keepalive: true,
  }).catch(() => {});
}
