import { type ButtonHTMLAttributes, forwardRef } from "react";

// מקביל ל-.btn ב-design-system/components/buttons.html
type Variant = "primary" | "accent" | "navy" | "secondary" | "quiet";
type Size = "md" | "lg";

const variants: Record<Variant, string> = {
  primary:
    "bg-brand text-white shadow-[0_6px_0_var(--brand-deep)] active:translate-y-0.5 active:shadow-[0_3px_0_var(--brand-deep)]",
  accent:
    "bg-yellow text-ink shadow-[0_6px_0_var(--yellow-deep)] active:translate-y-0.5 active:shadow-[0_3px_0_var(--yellow-deep)]",
  navy: "bg-navy text-gold-lite shadow-[0_6px_0_#05102a] active:translate-y-0.5 active:shadow-[0_3px_0_#05102a]",
  secondary: "border-[2.5px] border-brand bg-surface text-brand",
  quiet: "bg-transparent text-muted",
};

const sizes: Record<Size, string> = {
  md: "min-h-12 px-5 text-[17px]",
  lg: "min-h-14 px-8 text-lg",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { variant = "primary", size = "md", className = "", ...props },
    ref
  ) {
    return (
      <button
        ref={ref}
        className={`inline-flex items-center justify-center gap-2 rounded-card-sm font-extrabold transition-all disabled:pointer-events-none disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`}
        {...props}
      />
    );
  }
);
