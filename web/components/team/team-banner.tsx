import { Chip } from "@/components/ui/chip";
import type { Team } from "@/lib/supabase/types";

/**
 * כותרת מסך הקבוצה — סקיצה 2a.
 *
 * בשונה מ-`TeamHeader` (כרטיס בשורה, לרשימות), זו כותרת־מסך: רקע
 * מגוון בצבע הקבוצה, אריח חיה 74px ושם ב-30px. הצבע נכנס פעמיים —
 * ‎12% לרקע הרצועה ו-18% לאריח — כדי שהאריח ייקרא מעל הרקע ולא
 * ייבלע בו.
 */
export function TeamBanner({
  team,
  rank,
  note,
}: {
  team: Pick<Team, "name" | "color" | "animal">;
  rank?: number;
  note?: string;
}) {
  return (
    <header
      className="border-b border-line px-5 pt-12 pb-4.5 text-center"
      style={{ background: `color-mix(in srgb, ${team.color} 12%, #fff)` }}
    >
      <span
        aria-hidden
        className="inline-flex size-[74px] items-center justify-center rounded-[22px] border-2 text-[44px]"
        style={{
          background: `color-mix(in srgb, ${team.color} 18%, #fff)`,
          borderColor: team.color,
        }}
      >
        {team.animal?.split(" ")[0] ?? "🏁"}
      </span>

      <p className="mt-1.5 font-display text-[30px]">{team.name}</p>

      <div className="mt-1.5 flex justify-center gap-2">
        {rank ? <Chip>🏅 מקום {rank}</Chip> : null}
        {note ? <Chip tone="muted">{note}</Chip> : null}
      </div>
    </header>
  );
}
