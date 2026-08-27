import { WalkerSprite } from "@/components/ui/walking-spinner";

/**
 * רצועת ההפתעה בתחתית דף הבית — סבא וסבתא חוצים את המסך על כביש
 * שחור (סקיצה 1a, ה-tweak `walkerSurprise`).
 *
 * הם **לא משתתפים במירוץ** (design-system/components/characters.html):
 * הרצועה היא הופעה קצרה ולא אלמנט שדורש תשומת לב, ולכן היא בתחתית
 * ובלי טקסט. walking-spinner.html מסייג: "ההפתעה ההולכת — לא יותר
 * מפעם ב-3 דקות". כאן זה מתקיים מעצמו: המחזור הוא 9 שניות אבל
 * הרצועה נמצאת רק בדף הבית, שממנו ממשיכים הלאה.
 */
export function WalkerBand() {
  return (
    <div className="walker-band-wrap relative mt-auto mb-6.5 h-22 overflow-hidden rounded-card bg-yellow">
      {/* הכביש */}
      <div className="absolute inset-x-0 bottom-0 h-[13px] bg-ink" />
      {/* ⚠️ בצילום headless הרצועה נראית ריקה, וזה לא באג: השעון
          הווירטואלי של Chrome לא מקדם אנימציות CSS, ולכן הזוג נתפס
          תמיד בפריים 0 — מחוץ למסך מימין. כדי לראות אותו בצילום צריך
          `animation-delay` שלילי זמני. */}
      <WalkerSprite
        height={76}
        className="walker-band absolute bottom-[9px] animate-[walkcycle_0.9s_steps(8)_infinite,cross_9s_linear_infinite]"
      />
    </div>
  );
}
