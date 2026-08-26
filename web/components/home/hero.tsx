import type { ReactNode } from "react";
import { Countdown } from "@/components/countdown";
import { Chip } from "@/components/ui/chip";
import type { Race } from "@/lib/supabase/types";

/**
 * ההיירו הקוסמי של דף הבית — סקיצה 1a.
 *
 * זה המסך הראשון שבן משפחה רואה, והוא היה עד עכשיו כותרת אדומה על
 * נייר: כל שפת המותג (זהב על שמי חלל) הופיעה רק עמוק בתוך המשחק.
 *
 * הפינות התחתונות מעוגלות והעליונות לא — ההיירו "יוצא" מראש המסך
 * ונקטע בתחתית, ולכן הוא נדבק לקצה העליון בלי מרווח.
 */
export function HomeHero({
  race,
  action,
}: {
  race: Pick<Race, "year" | "name" | "starts_at" | "status"> | null;
  action: ReactNode;
}) {
  return (
    <header className="cosmic rounded-b-[30px] px-5 pt-14 pb-7 text-center shadow-navy">
      <Chip tone="yellow">🏁 יום העצמאות · בית סבא וסבתא</Chip>

      <p className="goldtext mt-3.5 font-display text-[46px] leading-none">
        המירוץ
        <br />
        למיליון
      </p>

      {race ? (
        // התג המשושה מ-brand.html. `dir="ltr"` כי זו שנה ולא טקסט
        <p
          dir="ltr"
          className="hex-badge mt-3 inline-block bg-brand px-5 py-1 font-display text-lg text-white"
        >
          {race.year}
        </p>
      ) : null}

      <div className="mt-5">
        {race?.starts_at ? (
          <Countdown target={race.starts_at} />
        ) : (
          <p className="text-on-navy-muted">
            עוד לא נקבע תאריך למירוץ הבא — תכף מעדכנים 🗓️
          </p>
        )}
      </div>

      {race?.status === "live" ? (
        <p className="mt-3 text-sm font-bold text-on-navy-muted">
          🔴 {race.name} — רץ עכשיו
        </p>
      ) : null}

      <div className="mt-5.5">{action}</div>
    </header>
  );
}
