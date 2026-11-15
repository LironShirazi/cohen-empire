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

/**
 * כפתור חזרה צף בפינה העליונה (צד ההתחלה — ימין ב-RTL) — למסכים שאין
 * להם `PageHeader` אלא רצועה מלאה (קבוצה, לידרבורד, זוכים, היכל התהילה).
 * קודם הקישור ישב בתחתית העמוד, מתחת לכל התוכן, ומשתמשים לא מצאו אותו.
 *
 * ההורה חייב להיות `relative`. גובה 44px — מטרת מגע מינימלית, ושבב
 * עם רקע ולא טקסט חשוף כדי שייקרא מעל רצועה צבעונית או קוסמית.
 */
export function CornerBack({
  href,
  label,
  tone = "light",
}: {
  href: string;
  label: string;
  /** `navy` — מעל הרקע הקוסמי */
  tone?: "light" | "navy";
}) {
  const toneClass =
    tone === "navy"
      ? "border-white/20 bg-white/10 text-white hover:text-yellow"
      : "border-line bg-surface/85 text-ink shadow-card hover:text-brand";
  return (
    <Link
      href={href}
      className={`absolute top-3 start-3 z-10 inline-flex min-h-11 items-center gap-1 rounded-full border px-3.5 text-sm font-bold backdrop-blur-sm ${toneClass}`}
    >
      <Icon name="back" size={18} />
      {label}
    </Link>
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
