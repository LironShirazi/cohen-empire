import { notFound, redirect } from "next/navigation";
import { RecipeShell } from "@/components/recipes/rb";
import { RecipeWizard } from "@/components/recipes/recipe-wizard";
import { getProfile, getUser } from "@/lib/data";
import { getRecipe, getRecipeOwnerSuggestions } from "@/lib/recipes-data";

export const metadata = {
  title: "עריכת מתכון — אימפריית כהן",
};

/**
 * עריכת מתכון — אותו אשף כמו ההוספה, מתחיל מהמתכון השמור.
 * רק מי שהוסיף ומנהל-על; השער כאן הוא נוחות, האכיפה ב-`recipes_update` (0023).
 */
export default async function EditRecipePage(
  props: PageProps<"/recipes/[recipeId]/edit">
) {
  const user = await getUser();
  if (!user) redirect("/recipes");

  const { recipeId } = await props.params;
  const [recipe, profile, { me, others }] = await Promise.all([
    getRecipe(recipeId),
    getProfile(),
    getRecipeOwnerSuggestions(),
  ]);
  if (!recipe) notFound();
  if (recipe.created_by !== user.id && !profile?.is_owner) {
    redirect(`/recipes/${recipeId}`);
  }

  return (
    <RecipeShell>
      <RecipeWizard userId={user.id} me={me} suggestions={others} recipe={recipe} />
    </RecipeShell>
  );
}
