import Link from "next/link";
import type { ReactNode } from "react";

export function PageShell({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <main className={`mx-auto w-full max-w-lg flex-1 px-4 py-6 ${className}`}>
      {children}
    </main>
  );
}

export function PageHeader({
  title,
  back,
  backLabel = "חזרה",
  action,
}: {
  title: string;
  back?: string;
  backLabel?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-5 flex items-center gap-3">
      {back ? (
        <Link
          href={back}
          className="text-sm font-bold text-muted hover:text-brand"
        >
          → {backLabel}
        </Link>
      ) : null}
      <h1 className="font-display text-2xl">{title}</h1>
      {action ? <div className="ms-auto">{action}</div> : null}
    </header>
  );
}

/** הודעת שגיאה מטופס — אותו מראה בכל המסכים */
export function FormError({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <p className="rounded-card-sm bg-brand-soft px-3.5 py-2.5 text-sm font-bold text-brand">
      {children}
    </p>
  );
}
