import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

// מקביל ל-.field ב-design-system/styles.css
const control =
  "w-full rounded-card-sm border-2 border-line bg-white px-3.5 font-[inherit] text-lg " +
  "focus:border-brand focus:ring-4 focus:ring-brand-soft focus:outline-none";

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
