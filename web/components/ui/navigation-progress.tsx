"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * פס התקדמות דק בראש המסך בזמן מעבר בין ראוטים.
 *
 * ‎`app/loading.tsx` מופיע מיד **רק** כשה-`<Link>` הספיק לעשות prefetch.
 * בנייד וברשת איטית הלחיצה מגיעה לפניו, והמסך הישן נשאר קפוא 2–3
 * שניות בלי שום סימן שמשהו קורה. הפס סוגר בדיוק את החור הזה.
 *
 * ההתחלה: לחיצה על כל `<a>` פנימי (מאזין יחיד ב-capture על המסמך —
 * מכסה את כל ה-Link-ים בלי לעטוף כל אחד), או `startNavProgress()`
 * לפני `router.push`, שלא עובר דרך שום קישור.
 * הסוף: שינוי ב-pathname או ב-searchParams — הרגע שבו Next עידכן היסטוריה.
 *
 * ⚠️ הפס מופיע רק אחרי SHOW_DELAY_MS. מעבר שכבר עבר prefetch מסתיים
 * מהר מזה, ופס שמהבהב על כל לחיצה מהירה הוא רעש ולא משוב.
 */

const START_EVENT = "nav-progress:start";
const SHOW_DELAY_MS = 120;
// רשת ביטחון: ניווט שנכשל/בוטל לא מעדכן כתובת, והפס לא יכול להיתקע לנצח
const GIVE_UP_MS = 15_000;

/**
 * להפעלה לפני `router.push` — לחיצה על קישור מפעילה את הפס לבד.
 * מקבל את היעד מאותה סיבה שהלחיצה בודקת אותו: ניווט לאותו מסך לא
 * משנה כתובת, ופס שהתחיל בלי סוף נתקע עד GIVE_UP_MS.
 */
export function startNavProgress(href: string) {
  if (!changesPage(new URL(href, location.href))) return;
  window.dispatchEvent(new Event(START_EVENT));
}

function changesPage(url: URL): boolean {
  if (url.origin !== location.origin) return false;
  // אותו מסך (או רק עוגן בתוכו, כמו `#m-<id>` בצ'אט) — אין ניווט לחכות לו
  return url.pathname !== location.pathname || url.search !== location.search;
}

function isInternalNavigation(event: MouseEvent): boolean {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  ) {
    return false;
  }
  const anchor = (event.target as Element | null)?.closest?.("a");
  if (!anchor || !anchor.href) return false;
  if (anchor.target && anchor.target !== "_self") return false;
  if (anchor.hasAttribute("download")) return false;

  return changesPage(new URL(anchor.href, location.href));
}

type Phase = "idle" | "loading" | "done";

export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [phase, setPhaseState] = useState<Phase>("idle");
  const phaseRef = useRef<Phase>("idle");
  const timers = useRef<number[]>([]);

  function setPhase(next: Phase) {
    phaseRef.current = next;
    setPhaseState(next);
  }

  function clearTimers() {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  }

  useEffect(() => {
    function start() {
      clearTimers();
      timers.current.push(
        window.setTimeout(() => setPhase("loading"), SHOW_DELAY_MS),
        window.setTimeout(() => setPhase("idle"), GIVE_UP_MS)
      );
    }
    function onClick(event: MouseEvent) {
      if (isInternalNavigation(event)) start();
    }
    document.addEventListener("click", onClick, true);
    window.addEventListener(START_EVENT, start);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener(START_EVENT, start);
      clearTimers();
    };
  }, []);

  // הכתובת התחלפה — הניווט הסתיים. אם הפס עוד לא הופיע, הוא פשוט לא
  // יופיע; אם הופיע — מושלם ל-100% ודוהה
  useEffect(() => {
    clearTimers();
    if (phaseRef.current !== "loading") {
      if (phaseRef.current !== "idle") setPhase("idle");
      return;
    }
    setPhase("done");
    timers.current.push(window.setTimeout(() => setPhase("idle"), 400));
  }, [pathname, searchParams]);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px]"
    >
      <div
        className={`nav-progress h-full ${
          phase === "loading" ? "is-loading" : phase === "done" ? "is-done" : ""
        }`}
      />
    </div>
  );
}
