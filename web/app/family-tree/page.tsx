import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { Card } from "@/components/ui/card";
import { PageShell } from "@/components/ui/page";
import { getProfile, getUser } from "@/lib/data";
import { TreeCanvas } from "./tree-canvas";

export const metadata = {
  title: "🌳 העץ המשפחתי — אימפריית כהן",
};

/**
 * העץ המשפחתי (docs/06). עד שלב 3 זה היה עמוד סטטי נפרד עם נתונים
 * ב-localStorage; מכאן זה ראוט באפליקציה, וזו לא רק החלטה עיצובית:
 * "אני בעץ" צריך לדעת מי המשתמש המחובר, וה-RLS ב-0010 לא מחזיר
 * שורות למי שאינו מחובר.
 *
 * מנוע העץ עצמו נשאר vanilla JS תחת `public/family-tree/js` — הפריסה
 * (union-find, שיוך דורות, מרכוז) והרינדור ל-SVG עובדים, ו-React לא
 * היה קונה להם כלום (docs/06 §3).
 */
export default async function FamilyTreePage() {
  const user = await getUser();

  if (!user) {
    return (
      <PageShell className="flex flex-col items-center gap-6 text-center">
        <span className="text-6xl">🌳</span>
        <h1 className="font-display text-3xl text-brand">העץ המשפחתי</h1>
        <Card className="flex flex-col items-center gap-4">
          <p className="text-muted">
            העץ שייך לכל המשפחה — צריך להתחבר כדי לראות אותו ולהוסיף את
            עצמכם אליו.
          </p>
          <GoogleSignInButton />
        </Card>
      </PageShell>
    );
  }

  const profile = await getProfile();

  return <TreeCanvas userId={user.id} isOwner={!!profile?.is_owner} />;
}
