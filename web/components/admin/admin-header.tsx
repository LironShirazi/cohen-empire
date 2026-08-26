import Link from "next/link";
import type { ReactNode } from "react";
import { Chip } from "@/components/ui/chip";
import type { RaceStatus } from "@/lib/supabase/types";

/**
 * הרצועה הכהה של מסכי הניהול — סבב 3 בסקיצות.
 *
 * ⚠️ **זו קונבנציה ולא קישוט.** בכל תשעת מסכי הניהול הסקיצה מניחה
 * פס navy למעלה וגוף בהיר מתחת, והמשמעות פונקציונלית: המנהל התורן
 * הוא גם משתתף, ומחליף בין המסכים שלו למסכי הקבוצה שלו באמצע מירוץ.
 * הרקע הכהה הוא מה שאומר לו במבט אחד באיזה צד הוא נמצא.
 */
export function AdminHeader({
  title,
  back,
  backLabel = "לרשימת המירוצים",
  meta,
  status,
  children,
}: {
  title: string;
  back?: string;
  backLabel?: string;
  meta?: string;
  /** כשמועבר — מוצג צינור ארבעת השלבים של המירוץ */
  status?: RaceStatus;
  children?: ReactNode;
}) {
  return (
    <header className="cosmic rounded-b-3xl px-5 pt-14 pb-5.5 shadow-navy">
      <div className="flex items-center gap-2">
        <Chip tone="ghost">🎛 מצב ניהול</Chip>
        {meta ? (
          <span className="ms-auto text-[13px] text-on-navy-muted">{meta}</span>
        ) : null}
      </div>

      <h1 className="mt-3 font-display text-[27px]">{title}</h1>

      {status ? <Pipeline status={status} /> : null}

      {back ? (
        <Link
          href={back}
          className="mt-3 inline-block text-sm font-bold text-on-navy-muted hover:text-yellow"
        >
          → {backLabel}
        </Link>
      ) : null}

      {children}
    </header>
  );
}

const steps: { status: RaceStatus; label: string }[] = [
  { status: "draft", label: "הכנה" },
  { status: "open", label: "הרשמה" },
  { status: "live", label: "מירוץ" },
  { status: "finished", label: "סיום" },
];

/**
 * צינור ארבעת השלבים (סקיצה 3a). `archived` אינו שלב חמישי אלא
 * מצב של "סיום" אחרי נעילה, ולכן הוא נופל על אותו שלב אחרון.
 */
function Pipeline({ status }: { status: RaceStatus }) {
  const current = status === "archived" ? 3 : steps.findIndex((s) => s.status === status);

  return (
    <div className="mt-3.5 flex items-center gap-1.5">
      {steps.map((step, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <span
            key={step.status}
            className={`flex-1 rounded-full px-1 py-2 text-center text-xs font-extrabold ${
              done
                ? "bg-gold-lite/22 text-gold-lite"
                : active
                  ? "bg-brand text-white"
                  : "bg-white/8 text-on-navy-muted/70"
            }`}
          >
            {done ? "✓" : active ? "●" : ""} {step.label}
          </span>
        );
      })}
    </div>
  );
}

/** מעטפת הגוף הבהיר שמתחת לרצועה */
export function AdminBody({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`mx-auto flex w-full max-w-lg flex-1 flex-col gap-3.5 px-5 pt-4 pb-10 ${className}`}
    >
      {children}
    </div>
  );
}
