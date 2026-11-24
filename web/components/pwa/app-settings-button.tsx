"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Sheet } from "@/components/ui/sheet";
import {
  currentSubscription,
  disablePush,
  enablePush,
  isIos,
  isStandalone,
  pushSupport,
  syncPushSubscription,
  type PushSupport,
} from "@/lib/push";

/** האירוע של כרום/אנדרואיד — לא בטיפוסי ה-DOM הסטנדרטיים */
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/** לחיצה ראשונה מכבה את הפעימה — פעם אחת לכל מכשיר */
const SEEN_KEY = "app-settings-seen";

function readSeen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return true; // בלי אחסון (גלישה פרטית) — לא מפעמים בכל טעינה
  }
}

/**
 * "התראות" — עיגול נעוץ בקצה השמאלי של פס הסטוריז (CLAUDE.md §23).
 * לחיצה פותחת גיליון עם מתג ההתראות וההוספה למסך הבית.
 *
 * ⚠️ העיגול **מחוץ לאזור הגלילה** של הפס — כפריט אחרון ברשימה הוא היה
 * נדחק מחוץ למסך ברגע שיש כמה סטוריז. והוא בכוונה לא נראה כמו סטורי
 * של מישהו: פעמון במקום תמונה, טבעת מקווקוות במקום צבעונית.
 *
 * אנדרואיד: `beforeinstallprompt` נתפס וההתקנה נפתחת בלחיצה. iOS: אין
 * API להתקנה — צעדים. וגם: **Push שם עובד רק מאפליקציה שהותקנה**, ולכן
 * בספארי רגיל אין מתג אלא הסבר — בקשת הרשאה שם לא הייתה עושה כלום.
 */
export function AppSettingsButton() {
  const [ready, setReady] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [support, setSupport] = useState<PushSupport>("unsupported");
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(true);

  const refresh = useCallback(async () => {
    const sub = await currentSubscription().catch(() => null);
    setInstalled(isStandalone());
    setIos(isIos());
    setSupport(pushSupport());
    setEnabled(!!sub);
    setSeen(readSeen());
    setReady(true);
  }, []);

  useEffect(() => {
    // לא סינכרוני: המצב נקרא מ-API של הדפדפן שלא קיים בשרת
    const first = setTimeout(() => void refresh(), 0);
    // מכשיר שכבר אישר התראות: מחברים אותו למשתמש המחובר עכשיו
    void syncPushSubscription().catch(() => {});

    const onPrompt = (e: Event) => {
      e.preventDefault(); // שומרים לכפתור שלנו במקום באנר הדפדפן
      setInstallEvent(e as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstallEvent(null);
      void refresh();
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      clearTimeout(first);
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [refresh]);

  const openSheet = () => {
    setOpen(true);
    if (!seen) {
      setSeen(true);
      try {
        localStorage.setItem(SEEN_KEY, "1");
      } catch {
        // בלי אחסון — הפעימה פשוט תחזור בטעינה הבאה
      }
    }
  };

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    // האירוע חד-פעמי: אחרי שנוצל (אושר או נדחה) צריך לחכות לאירוע חדש
    setInstallEvent(null);
    if (outcome === "accepted") void refresh();
  };

  const toggle = async () => {
    setBusy(true);
    setError(null);
    try {
      if (enabled) {
        await disablePush();
      } else {
        // ⚠️ ישירות מהלחיצה — ב-iOS בקשת הרשאה שלא ממחווה נדחית בשקט
        const result = await enablePush();
        if (result === "denied") setError("ההתראות לא אושרו. אפשר לשנות בהגדרות הדפדפן.");
      }
    } catch (e) {
      console.error("push toggle", e);
      setError(enabled ? "לא הצלחנו לכבות. נסו שוב." : "לא הצלחנו להפעיל. נסו שוב בעוד רגע.");
    } finally {
      await refresh();
      setBusy(false);
    }
  };

  if (!ready) return null;

  const canNotify = support !== "unsupported";
  // מותקן ובלי Push (למשל בלי מפתחות VAPID) — אין מה להציע
  if (installed && !canNotify) return null;

  // מה שהעיגול אומר במבט: הכל מסודר / חסום / יש מה לעשות
  const status: "ok" | "blocked" | "todo" = enabled
    ? "ok"
    : support === "denied"
      ? "blocked"
      : "todo";

  return (
    <>
      <button
        type="button"
        onClick={openSheet}
        aria-label="התראות והוספה למסך הבית"
        className="flex w-[68px] flex-none cursor-pointer flex-col items-center gap-1.5"
      >
        <span className="relative block">
          {!seen && status === "todo" ? (
            <span
              aria-hidden
              className="absolute inset-0 rounded-full bg-yellow/50 motion-safe:animate-ping"
            />
          ) : null}
          <span className="relative flex size-16 items-center justify-center rounded-full border-2 border-dashed border-yellow/80 p-[3px]">
            <span className="flex size-full items-center justify-center rounded-full bg-yellow text-ink">
              <Icon name="bell" size={26} />
            </span>
          </span>
          {status === "todo" ? (
            <span
              aria-hidden
              className="absolute top-0.5 left-0.5 size-[15px] rounded-full border-[2.5px] border-navy bg-brand"
            />
          ) : (
            <span
              aria-hidden
              className={`absolute bottom-0 left-0 flex size-[23px] items-center justify-center rounded-full border-[2.5px] border-navy text-white ${
                status === "ok" ? "bg-ok" : "bg-muted"
              }`}
            >
              <Icon name={status === "ok" ? "check" : "minus"} size={13} />
            </span>
          )}
        </span>
        <span className="text-[11.5px] font-bold whitespace-nowrap text-white">התראות</span>
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} label="התראות ומסך הבית">
        <h2 className="font-display text-h2">התראות ומסך הבית</h2>

        {/* ── התראות ── */}
        <section className="mt-4 flex items-start gap-3">
          <span className="grid size-11 flex-none place-items-center rounded-full bg-brand-soft text-brand">
            <Icon name="bell" size={24} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-bold">התראות על סטוריז</p>
            <p className="text-small text-muted">
              {support === "denied"
                ? "ההתראות חסומות בהגדרות הדפדפן — צריך לאשר אותן שם."
                : support === "needs-install"
                  ? "ב-iPhone התראות עובדות רק אחרי הוספה למסך הבית (למטה)."
                  : support === "unsupported"
                    ? "הדפדפן הזה לא תומך בהתראות."
                    : enabled
                      ? "פועלות במכשיר הזה. נעדכן כשמישהו מעלה סטורי."
                      : "נעדכן כשמישהו מהמשפחה מעלה סטורי."}
            </p>
          </div>
          {support === "ready" ? (
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              aria-label="התראות על סטוריז"
              onClick={toggle}
              disabled={busy}
              className={`relative mt-1 h-8 w-[52px] flex-none cursor-pointer rounded-full transition-colors disabled:opacity-60 ${
                enabled ? "bg-ok" : "bg-muted/40"
              }`}
            >
              {/* ב-RTL "פועל" = הידית בצד שמאל, כמו במתגים של iOS בעברית */}
              <span
                aria-hidden
                className={`absolute top-1 size-6 rounded-full bg-white shadow-card transition-[right] ${
                  enabled ? "right-[24px]" : "right-1"
                }`}
              />
            </button>
          ) : null}
        </section>
        {error ? <p className="mt-2 text-small font-bold text-danger">{error}</p> : null}

        <div aria-hidden className="my-4 h-px bg-line" />

        {/* ── מסך הבית ── */}
        <section className="flex items-start gap-3">
          <span className="grid size-11 flex-none place-items-center rounded-full bg-brand-soft text-brand">
            <Icon name="home" size={24} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-bold">האפליקציה על מסך הבית</p>
            {installed ? (
              <p className="flex items-center gap-1 text-small font-bold text-ok">
                <Icon name="check" size={16} />
                כבר על מסך הבית
              </p>
            ) : (
              <p className="text-small text-muted">פתיחה במסך מלא, בלחיצה אחת</p>
            )}
          </div>
        </section>

        {!installed && installEvent ? (
          <Button size="lg" className="mt-4 w-full" onClick={install}>
            <Icon name="download" size={24} />
            הוספה למסך הבית
          </Button>
        ) : null}

        {!installed && !installEvent ? (
          <ol className="mt-3 flex list-decimal flex-col gap-2 ps-5 text-[17px]">
            {ios ? (
              <>
                <li>
                  לוחצים על כפתור השיתוף{" "}
                  <Icon name="share" size={18} className="inline-block align-text-bottom text-brand" />{" "}
                  בסרגל של ספארי.
                </li>
                <li>בוחרים &quot;הוספה למסך הבית&quot;.</li>
              </>
            ) : (
              <>
                <li>פותחים את תפריט הדפדפן (שלוש הנקודות).</li>
                <li>בוחרים &quot;התקנת אפליקציה&quot; או &quot;הוספה למסך הבית&quot;.</li>
              </>
            )}
            <li>פותחים מהאייקון החדש, ומתחברים בו פעם אחת.</li>
          </ol>
        ) : null}

        <Button variant="quiet" className="mt-5 w-full" onClick={() => setOpen(false)}>
          סגירה
        </Button>
      </Sheet>
    </>
  );
}
