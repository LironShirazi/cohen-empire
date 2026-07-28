import Link from "next/link";
import { type ReactNode, type ButtonHTMLAttributes } from "react";

const variants = {
  primary:
    "bg-primary text-white hover:bg-primary-dark active:scale-[0.98] shadow-card",
  secondary:
    "bg-primary-soft text-primary-dark hover:bg-primary-soft/70 active:scale-[0.98]",
  ghost: "bg-transparent text-ink-soft hover:bg-primary-soft/50",
} as const;

const base =
  "inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-lg font-bold transition-all";

type Variant = keyof typeof variants;

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
}) {
  return (
    <button
      className={`${base} ${variants[variant]} ${className}`}
      {...props}
    />
  );
}

export function ButtonLink({
  href,
  variant = "primary",
  className = "",
  children,
}: {
  href: string;
  variant?: Variant;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={`${base} ${variants[variant]} ${className}`}>
      {children}
    </Link>
  );
}
