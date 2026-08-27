import type { CSSProperties } from "react";

/**
 * הספרייט של סבא וסבתא — 8 פריימים בני 302×420 מתוך
 * public/brand/walk-strip.png (design-system/components/walking-spinner.html).
 *
 * החישוב יושב כאן ולא בכל קורא: הרוחב הוא `h*302/420`, ורוחב הרקע
 * הוא `h*2416/420` (הרצועה כולה). מי שיעתיק את המספרים האלה למקום
 * שני ויעדכן ספרייט אחר ימצא את עצמו עם חצי דמות.
 */
export function WalkerSprite({
  height,
  className = "",
  style,
}: {
  height: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      aria-hidden
      className={`bg-[url('/brand/walk-strip.png')] bg-no-repeat ${className}`}
      style={
        {
          height,
          width: (height * 302) / 420,
          backgroundSize: `${(height * 2416) / 420}px ${height}px`,
          "--walk-h": `${height}px`,
          ...style,
        } as CSSProperties
      }
    />
  );
}

/** ספינר הטעינה — ה-DS קובע שהוא מחליף כל מסך טעינה, בגובה 88–120px */
export function WalkingSpinner({
  label,
  height = 96,
  tone = "light",
}: {
  label?: string;
  height?: number;
  tone?: "light" | "cosmic";
}) {
  return (
    <div
      className={`flex flex-col items-center gap-2 rounded-card p-6 text-center ${
        tone === "cosmic" ? "cosmic shadow-navy" : ""
      }`}
    >
      <WalkerSprite
        height={height}
        className="animate-[walkcycle_0.9s_steps(8)_infinite]"
      />
      {label ? (
        <span
          className={`font-bold ${tone === "cosmic" ? "goldtext font-display text-xl" : ""}`}
        >
          {label}
        </span>
      ) : null}
      <span className="flex gap-1.5" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="size-2 animate-[blink_1.2s_infinite] rounded-full bg-gold"
            style={{ animationDelay: `${i * 0.2}s` }}
          />
        ))}
      </span>
    </div>
  );
}
