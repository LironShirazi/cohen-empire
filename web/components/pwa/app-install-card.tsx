"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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

/**
 * "הוסיפו למסך הבית" + "הפעילו התראות" — כרטיס בדף הבית למחוברים
 * (CLAUDE.md §23).
 *
 * אנדרואיד: `beforeinstallprompt` נתפס וההתקנה נפתחת בלחיצה.
 * iOS: אין API להתקנה — גיליון הסבר עם שלושת הצעדים. וגם: **Push שם
 * עובד רק מאפליקציה שהותקנה**, ולכן "הפעלת התראות" בספארי רגיל פותחת
 * את אותו הסבר ולא בקשת הרשאה (שלא הייתה עושה כלום).
 *
 * כשהכל כבר פועל הכרטיס מצטמצם לשורה קטנה עם כיבוי — המשפחה לא צריכה
 * לראות באנר קבוע על משהו שכבר סידרה.
 */
export function AppInstallCard() {
  const [ready, setReady] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [support, setSupport] = useState<PushSupport>("unsupported");
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [help, setHelp] = useState(false);

  const refresh = useCallback(async () => {
    const sub = await currentSubscription().catch(() => null);
    setInstalled(isStandalone());
    setIos(isIos());
    setSupport(pushSupport());
    setEnabled(!!sub);
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

  const install = async () => {
    if (!installEvent) {
      setHelp(true);
      return;
    }
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    // האירוע חד-פעמי: אחרי שנוצל (אושר או נדחה) צריך לחכות לאירוע חדש
    setInstallEvent(null);
    if (outcome === "accepted") void refresh();
  };

  const turnOn = async () => {
    if (support === "needs-install") {
      setHelp(true);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await enablePush();
      if (result === "denied") setError("ההתראות לא אושרו. אפשר לשנות בהגדרות הדפדפן.");
    } catch (e) {
      console.error("enablePush", e);
      setError("לא הצלחנו להפעיל התראות. נסו שוב בעוד רגע.");
    } finally {
      await refresh();
      setBusy(false);
    }
  };

  const turnOff = async () => {
    setBusy(true);
    setError(null);
    try {
      await disablePush();
    } catch (e) {
      console.error("disablePush", e);
      setError("לא הצלחנו לכבות. נסו שוב.");
    } finally {
      await refresh();
      setBusy(false);
    }
  };

  if (!ready) return null;

  const canInstall = !installed && (!!installEvent || ios);
  const canNotify = support !== "unsupported";
  if (!canInstall && !canNotify) return null;

  // הכל מסודר — שורה קטנה בלבד, עם דרך לכבות
  if (!canInstall && enabled) {
    return (
      <p className="flex items-center justify-center gap-1.5 text-small text-muted">
        <Icon name="bell" size={18} />
        התראות פועלות במכשיר הזה ·
        <button
          type="button"
          onClick={turnOff}
          disabled={busy}
          className="cursor-pointer font-bold text-brand underline disabled:opacity-50"
        >
          כיבוי
        </button>
        {error ? <span className="text-danger">{error}</span> : null}
      </p>
    );
  }

  return (
    <>
      <Card tight className="flex flex-col gap-3 p-4">
        {canInstall ? (
          <div className="flex items-center gap-3">
            <span className="grid size-11 flex-none place-items-center rounded-full bg-brand-soft text-brand">
              <Icon name="home" size={24} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-bold">האפליקציה על מסך הבית</p>
              <p className="text-small text-muted">פתיחה במסך מלא, בלחיצה אחת</p>
            </div>
            <Button size="md" onClick={install}>
              הוספה
            </Button>
          </div>
        ) : null}

        {canNotify && !enabled ? (
          <div className="flex items-center gap-3">
            <span className="grid size-11 flex-none place-items-center rounded-full bg-brand-soft text-brand">
              <Icon name="bell" size={24} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-bold">התראות על סטוריז</p>
              <p className="text-small text-muted">
                {support === "denied"
                  ? "חסומות בהגדרות הדפדפן — צריך לאשר אותן שם"
                  : "נעדכן כשמישהו מהמשפחה מעלה סטורי"}
              </p>
            </div>
            {support === "denied" ? null : (
              <Button size="md" onClick={turnOn} disabled={busy}>
                הפעלה
              </Button>
            )}
          </div>
        ) : null}

        {canNotify && enabled ? (
          <p className="flex items-center gap-1.5 text-small text-muted">
            <Icon name="bell" size={18} />
            התראות פועלות במכשיר הזה ·
            <button
              type="button"
              onClick={turnOff}
              disabled={busy}
              className="cursor-pointer font-bold text-brand underline disabled:opacity-50"
            >
              כיבוי
            </button>
          </p>
        ) : null}

        {error ? <p className="text-small font-bold text-danger">{error}</p> : null}
      </Card>

      <Sheet open={help} onClose={() => setHelp(false)} label="הוספה למסך הבית">
        <h2 className="font-display text-h2">מוסיפים למסך הבית</h2>
        <ol className="mt-3 flex list-decimal flex-col gap-2.5 ps-5 text-lg">
          <li>
            לוחצים על כפתור השיתוף{" "}
            <Icon name="share" size={20} className="inline-block align-text-bottom text-brand" />{" "}
            בסרגל של הדפדפן.
          </li>
          <li>בוחרים &quot;הוספה למסך הבית&quot;.</li>
          <li>פותחים את האפליקציה מהאייקון החדש — ומתחברים בה פעם אחת.</li>
        </ol>
        {support === "needs-install" ? (
          <p className="mt-3 rounded-card-sm bg-brand-soft p-3 text-small font-bold text-brand">
            ב-iPhone התראות עובדות רק אחרי שהאפליקציה על מסך הבית. אחרי ההוספה, לחצו שם
            על &quot;הפעלה&quot; בדף הבית.
          </p>
        ) : null}
        <Button className="mt-5 w-full" onClick={() => setHelp(false)}>
          הבנתי
        </Button>
      </Sheet>
    </>
  );
}
