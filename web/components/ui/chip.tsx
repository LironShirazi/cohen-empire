import type { HTMLAttributes } from "react";

// מקביל ל-.chip ב-design-system/styles.css
type Tone = "brand" | "yellow" | "navy" | "ok" | "muted";

const tones: Record<Tone, string> = {
  brand: "bg-brand-soft text-brand",
  yellow: "bg-yellow text-ink",
  navy: "bg-navy text-gold-lite",
  ok: "bg-[#DBF3E6] text-ok",
  muted: "bg-bg-2 text-muted",
};

export function Chip({
  tone = "brand",
  className = "",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-extrabold ${tones[tone]} ${className}`}
      {...props}
    />
  );
}
