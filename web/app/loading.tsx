import { WalkingSpinner } from "@/components/ui/walking-spinner";

/**
 * מסך הטעינה של כל האפליקציה.
 *
 * ‎design-system/components/walking-spinner.html קובע שהספינר הזה
 * מחליף **כל** מסך טעינה, בגובה 88–120px. עד עכשיו לא היה בפרויקט
 * אף `loading.tsx`, ולכן מעבר בין ראוטים הראה מסך קפוא.
 *
 * הוא יושב בשורש ולכן חל על כל ראוט שאין לו משלו — עדיף על העתקת
 * אותו קובץ לשבעה מקומות.
 */
export default function Loading() {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <WalkingSpinner label="סבא וסבתא בדרך אליכם…" height={104} />
    </div>
  );
}
