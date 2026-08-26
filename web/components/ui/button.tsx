import { type ButtonHTMLAttributes, forwardRef } from "react";

// מקביל ל-.btn ב-design-system/components/buttons.html
type Variant = "primary" | "accent" | "navy" | "secondary" | "quiet";
type Size = "md" | "lg";

const variants: Record<Variant, string> = {
  primary:
    "bg-brand text-white shadow-[0_6px_0_var(--brand-deep)] active:translate-y-0.5 active:shadow-[0_3px_0_var(--brand-deep)]",
  accent:
    "bg-yellow text-ink shadow-[0_6px_0_var(--yellow-deep)] active:translate-y-0.5 active:shadow-[0_3px_0_var(--yellow-deep)]",
  navy: "bg-navy text-gold-lite shadow-[0_6px_0_var(--navy-deep)] active:translate-y-0.5 active:shadow-[0_3px_0_var(--navy-deep)]",
  secondary: "border-[2.5px] border-brand bg-surface text-brand",
  quiet: "bg-transparent text-muted",
};

/**
 * ⚠️ `lg` הוא `.btn` של מערכת העיצוב — **60px ו-20px**, לא 56/18.
 * ה-DS מנמק את המספר במפורש (buttons.html): "נוח לילד בן 3 ולסבתא
 * בת 70". `md` הוא תוספת של האפליקציה ואין לו מקבילה ב-DS — הוא קיים
 * בשביל שורות הפעולה הצפופות ב-admin, שם 60px היו הופכים כל כרטיס
 * למגדל. הוא עלה מ-48 ל-52 כדי לא ליפול מתחת לרצפת המגע.
 */
const sizes: Record<Size, string> = {
  md: "min-h-[52px] px-5 text-[17px]",
  lg: "min-h-[60px] px-8 text-xl",
};

// ‎.btn-quiet ב-DS דורס את הגובה ל-48 ואת הגודל ל-17 — הוא הפעולה
// המשנית שלא אמורה להתחרות בכפתור הראשי, ולכן הווריאנט קובע ולא ה-size
const quietSize = "min-h-12 px-4 text-[17px]";

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
        // `rounded-full` ולא `rounded-card-sm`: ב-DS ‎.btn הוא
        // `border-radius:999px` — גלולה, לא מלבן מעוגל.
        // ה-disabled מוריד גם את הצל (buttons.html מדגים בדיוק את זה):
        // כפתור כבוי עם צל תחתון עדיין נראה לחיץ.
        className={`inline-flex items-center justify-center gap-2 rounded-full font-extrabold transition-all disabled:pointer-events-none disabled:opacity-45 disabled:shadow-none ${
          variants[variant]
        } ${variant === "quiet" ? quietSize : sizes[size]} ${className}`}
        {...props}
      />
    );
  }
);
