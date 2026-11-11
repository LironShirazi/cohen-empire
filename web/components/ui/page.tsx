import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/icon";

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
  icon,
  back,
  backLabel = "חזרה",
  action,
}: {
  title: string;
  /** אייקון לצד הכותרת — במקום האימוג׳י שהיה בתוך המחרוזת */
  icon?: IconName;
  back?: string;
  backLabel?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-5 flex items-center gap-3">
      {back ? (
        <Link
          href={back}
          className="inline-flex flex-none items-center gap-1 text-sm font-bold text-muted hover:text-brand"
        >
          <Icon name="back" size={16} />
          {backLabel}
        </Link>
      ) : null}
      {/* text-h1 ולא text-2xl — הסקאלה של typography.html היא 28px */}
      <h1 className="flex items-center gap-2 font-display text-h1">
        {icon ? <Icon name={icon} size={26} className="text-brand" /> : null}
        {title}
      </h1>
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
