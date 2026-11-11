import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { Icon } from "@/components/ui/icon";
import { RecipeBook } from "@/components/recipes/recipe-book";
import { RecipeShell, rb } from "@/components/recipes/rb";
import { getUser } from "@/lib/data";
import { getRecipes } from "@/lib/recipes-data";

export const metadata = {
  title: "ספר המתכונים — אימפריית כהן",
};

/**
 * ספר המתכונים המשפחתי (סבב 7, מיגרציה 0023).
 *
 * מחוברים בלבד, כמו הגלריה: המתכונים הם של המשפחה. מי שלא מחובר
 * מקבל את אותו מסך הזמנה עם כפתור התחברות.
 */
export default async function RecipesPage() {
  const user = await getUser();

  if (!user) {
    return (
      <RecipeShell>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-10 text-center">
          <Icon name="book" size={64} className="text-rb-green" />
          <h1 className="text-[28px] font-extrabold">ספר המתכונים</h1>
          <p className={`max-w-sm ${rb.muted}`}>
            המתכונים של המשפחה שמורים לבני המשפחה — צריך להתחבר כדי לקרוא
            אותם ולהוסיף משלכם.
          </p>
          <div className="w-full max-w-sm">
            <GoogleSignInButton next="/recipes" className="w-full" />
          </div>
        </div>
      </RecipeShell>
    );
  }

  const recipes = await getRecipes();

  return (
    <RecipeShell>
      <RecipeBook recipes={recipes} />
    </RecipeShell>
  );
}
