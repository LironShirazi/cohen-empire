"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui/button";

/**
 * דיאלוג אישור פנימי — מחליף את `window.confirm` בכל האפליקציה.
 *
 * ⚠️ **זה לא שיפור עיצובי, זה תיקון באג.** `confirm()` הוא דיאלוג
 * של הדפדפן, וספארי בנייד רשאי להשתיק אותו: מספיק שהמשתמש סימן פעם
 * אחת "אל תציג התראות נוספות מהעמוד הזה" (או שהעמוד מוצג מתוך
 * iframe בלי `allow-modals`) כדי ש-`confirm()` **יחזיר false מיד
 * ובלי להציג כלום**. כל מחיקה באפליקציה עברה דרכו, ולכן כולן נראו
 * למשתמש כמו כפתור מת: לוחצים, ושום דבר לא קורה.
 *
 * הפתרון היחיד שלא תלוי בהגדרות הדפדפן הוא דיאלוג שאנחנו מציירים.
 * הוא יושב ב-`layout.tsx` כדי שכל מסך יוכל לקרוא לו דרך
 * `useConfirm()` בלי לגרור state משלו.
 */
export type ConfirmOptions = {
  message: string;
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
};

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };

const ConfirmContext = createContext<
  ((options: ConfirmOptions) => Promise<boolean>) | null
>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  const ask = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setPending({ ...options, resolve });
      }),
    []
  );

  const close = useCallback(
    (ok: boolean) => {
      pending?.resolve(ok);
      setPending(null);
    },
    [pending]
  );

  useEffect(() => {
    if (!pending) return;
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [pending, close]);

  return (
    <ConfirmContext.Provider value={ask}>
      {children}
      {pending ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[120] flex items-end justify-center bg-navy/55 p-4 backdrop-blur-[2px] sm:items-center"
          onClick={() => close(false)}
        >
          <div
            className="w-full max-w-sm rounded-card-lg bg-surface p-5 shadow-card-lg"
            onClick={(e) => e.stopPropagation()}
          >
            {pending.title ? (
              <h2 className="mb-1.5 font-display text-h2">{pending.title}</h2>
            ) : null}
            <p className="mb-5 text-[17px] leading-relaxed">{pending.message}</p>
            <div className="flex gap-2">
              <Button
                ref={confirmRef}
                className="flex-1"
                onClick={() => close(true)}
              >
                {pending.confirmLabel ?? "כן, למחוק"}
              </Button>
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => close(false)}
              >
                {pending.cancelLabel ?? "ביטול"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </ConfirmContext.Provider>
  );
}

/** מחזיר `true` רק אם המשתמש אישר. תמיד לחכות לתשובה: `await confirm(...)` */
export function useConfirm() {
  const ask = useContext(ConfirmContext);
  if (!ask) throw new Error("useConfirm חייב לרוץ בתוך ConfirmProvider");
  return ask;
}
