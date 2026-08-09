/**
 * ספינר סבא וסבתא — design-system/components/walking-spinner.html.
 * ספרייט של 8 פריימים (302×420 כל אחד) מתוך public/brand/walk-strip.png.
 */
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
      <span
        aria-hidden
        className="animate-[walkcycle_0.9s_steps(8)_infinite] bg-[url('/brand/walk-strip.png')] bg-no-repeat"
        style={
          {
            height,
            width: (height * 302) / 420,
            backgroundSize: `${(height * 2416) / 420}px ${height}px`,
            "--walk-h": `${height}px`,
          } as React.CSSProperties
        }
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
