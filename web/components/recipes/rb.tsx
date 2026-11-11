import type { ReactNode } from "react";

/**
 * השפה של ספר המתכונים (סבב 7, ‎.rb בסקיצה) — נפרדת משאר האפליקציה
 * בכוונה: רקע בהיר, צבע אחד (ירוק), אותיות של 18px ומעלה, וכפתורים
 * של 60px. הקהל הוא סבא וסבתא, והמסך צריך לעבוד להם בלי עזרה.
 *
 * הצבעים הם הטוקנים `--rb-*` ב-globals.css. מחרוזות ולא רכיבים כדי
 * שאותו מראה ילבש גם `<a>` (Link) וגם `<button>`.
 */
export const rb = {
  btn: "flex min-h-[60px] w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-rb-green px-5 text-[20px] font-extrabold text-white active:brightness-90 disabled:cursor-default disabled:opacity-45",
  btn2: "flex min-h-[60px] cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-rb-green bg-white px-5 text-[19px] font-extrabold text-rb-green active:bg-rb-green-soft disabled:cursor-default disabled:opacity-45",
  ic: "flex size-[46px] flex-none cursor-pointer items-center justify-center rounded-full bg-rb-soft text-rb-ink",
  input:
    "h-[58px] w-full min-w-0 rounded-[14px] border-2 border-rb-field bg-white px-4 text-[19px] text-rb-ink placeholder:text-rb-faint focus:border-rb-green focus:outline-3 focus:outline-rb-focus",
  label: "mb-2 block text-[18px] font-bold",
  chip: "flex-none cursor-pointer whitespace-nowrap rounded-full border-2 px-4 py-2 text-[16px] font-semibold",
  chipOff: "border-rb-chip-line bg-white text-rb-ink",
  chipOn: "border-rb-green bg-rb-green text-white",
  section: "mt-6.5 mb-1.5 border-t-2 border-rb-line pt-5 text-[22px] font-extrabold",
  muted: "text-rb-muted",
};

/** המעטפת של כל מסכי הספר — מחליפה את רקע הנייר של האפליקציה */
export function RecipeShell({ children }: { children: ReactNode }) {
  return (
    <main className="flex flex-1 flex-col bg-rb-bg text-[18px] leading-[1.55] text-rb-ink">
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col">{children}</div>
    </main>
  );
}

/** עיגול השלב הממוספר בדף המתכון */
export function StepNumber({ n }: { n: number }) {
  return (
    <span
      aria-hidden
      className="flex size-[38px] flex-none items-center justify-center rounded-full bg-rb-green text-[18px] font-extrabold text-white"
    >
      {n}
    </span>
  );
}
