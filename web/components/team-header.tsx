import type { Team } from "@/lib/supabase/types";

/** כותרת הקבוצה — פס צבע + חיה, לפי design-system/components/team-card.html */
export function TeamHeader({
  team,
  subtitle,
}: {
  team: Pick<Team, "name" | "color" | "animal">;
  subtitle?: string;
}) {
  return (
    <div
      className="flex items-center gap-3 rounded-card border border-line bg-surface p-4 shadow-card"
      style={{ borderInlineStartWidth: 8, borderInlineStartColor: team.color }}
    >
      <span
        className="flex size-14 flex-none items-center justify-center rounded-2xl text-3xl"
        style={{ background: `color-mix(in srgb, ${team.color} 15%, #fff)` }}
      >
        {team.animal?.split(" ")[0] ?? "🏁"}
      </span>
      <div>
        <p className="font-display text-xl">{team.name}</p>
        {subtitle ? <p className="text-sm text-muted">{subtitle}</p> : null}
      </div>
    </div>
  );
}
