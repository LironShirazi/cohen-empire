import { notFound, redirect } from "next/navigation";
import { RecipeShell } from "@/components/recipes/rb";
import { RecipeView } from "@/components/recipes/recipe-view";
import { getProfile, getUser } from "@/lib/data";
import { getRecipe } from "@/lib/recipes-data";

export const metadata = {
  title: "מתכון — אימפריית כהן",
};

/** "לפני שבוע" — בשרת, כדי שהקליינט לא יחשב תאריך אחר ב-hydration */
function addedAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days < 1) return "היום";
  if (days === 1) return "אתמול";
  if (days < 7) return `לפני ${days} ימים`;
  if (days < 14) return "לפני שבוע";
  if (days < 31) return `לפני ${Math.floor(days / 7)} שבועות`;
  if (days < 60) return "לפני חודש";
  if (days < 365) return `לפני ${Math.floor(days / 30)} חודשים`;
  return days < 730 ? "לפני שנה" : `לפני ${Math.floor(days / 365)} שנים`;
}

export default async function RecipePage(props: PageProps<"/recipes/[recipeId]">) {
  const user = await getUser();
  if (!user) redirect("/recipes");

  const { recipeId } = await props.params;
  const [recipe, profile] = await Promise.all([getRecipe(recipeId), getProfile()]);
  if (!recipe) notFound();

  const addedLabel = [
    recipe.creator_name ? `נוסף ע״י ${recipe.creator_name}` : null,
    addedAgo(recipe.created_at),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <RecipeShell>
      <RecipeView
        recipe={recipe}
        addedLabel={addedLabel}
        canManage={recipe.created_by === user.id || !!profile?.is_owner}
      />
    </RecipeShell>
  );
}
