import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

// מקביל ל-.field ב-design-system/styles.css
const control =
  "w-full rounded-card-sm border-2 border-line bg-white px-3.5 font-[inherit] text-lg " +
  "focus:border-brand focus:ring-4 focus:ring-brand-soft focus:outline-none";

/**
 * שדה בלי תווית משלו — לטפסים שבהם התווית כבר קיימת מחוץ לרכיב
 * (שינוי שם אלבום, שורות ההזנה ב-/admin/content).
 *
 * ⚠️ קיים כדי שלא ישכפלו את `control` ידנית. ארבעה מקומות עשו בדיוק
 * את זה, וכל אחד מהם גם **סטה**: 48px במקום 56, ‎17px במקום 18,
 * ו-`bg-surface` במקום `bg-white`. הם נראים כמעט אותו דבר, וזה בדיוק
 * מה שמקשה לראות שהם שונים.
 */
export function Input({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${control} h-14 ${className}`} {...props} />;
}

/** אותו דבר ל-textarea (הזנת משפט ב-/admin/content) */
export function Textarea({
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${control} min-h-24 py-3 ${className}`} {...props} />;
}

export function Field({
  label,
  hint,
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[15px] font-bold">{label}</span>
      <input className={`${control} h-14 ${className}`} {...props} />
      {hint ? <span className="mt-1 block text-sm text-muted">{hint}</span> : null}
    </label>
  );
}

export function TextareaField({
  label,
  hint,
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[15px] font-bold">{label}</span>
      <textarea className={`${control} min-h-24 py-3 ${className}`} {...props} />
      {hint ? <span className="mt-1 block text-sm text-muted">{hint}</span> : null}
    </label>
  );
}

export function SelectField({
  label,
  hint,
  className = "",
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[15px] font-bold">{label}</span>
      <select className={`${control} h-14 ${className}`} {...props}>
        {children}
      </select>
      {hint ? <span className="mt-1 block text-sm text-muted">{hint}</span> : null}
    </label>
  );
}
