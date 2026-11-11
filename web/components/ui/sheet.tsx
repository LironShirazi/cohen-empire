"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * גיליון תחתון — הגיליונות של הסטוריז (6c, 6e, 6f): ידית, פינות עליונות
 * מעוגלות, וכיסוי כהה מעל המסך. לחיצה על הכיסוי או Escape סוגרים.
 *
 * ב-portal ל-body: הוא נפתח מתוך ההיירו, ש-`overflow` ו-`rounded` שלו
 * היו חותכים אותו.
 */
export function Sheet({
  open,
  onClose,
  label,
  children,
  className = "",
}: {
  open: boolean;
  onClose: () => void;
  /** שם הדיאלוג לקורא מסך — בד"כ הכותרת */
  label: string;
  children: ReactNode;
  className?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label={label}>
      <button
        type="button"
        aria-label="סגירה"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-navy/45"
      />
      <div
        className={`sheet-anim absolute inset-x-0 bottom-0 mx-auto max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-card-lg bg-surface px-5 pt-3 pb-[max(2rem,env(safe-area-inset-bottom))] text-ink shadow-card-lg [animation:sheet-up_.22s_ease-out] ${className}`}
      >
        <div aria-hidden className="mx-auto mb-4 h-[5px] w-11 rounded-full bg-line" />
        {children}
      </div>
    </div>,
    document.body
  );
}
