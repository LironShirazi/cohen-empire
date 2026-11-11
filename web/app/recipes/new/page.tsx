import { redirect } from "next/navigation";
import { RecipeShell } from "@/components/recipes/rb";
import { RecipeWizard } from "@/components/recipes/recipe-wizard";
import { getUser } from "@/lib/data";
import { getRecipeOwnerSuggestions } from "@/lib/recipes-data";

export const metadata = {
  title: "מתכון חדש — אימפריית כהן",
};

export default async function NewRecipePage() {
  const user = await getUser();
  if (!user) redirect("/recipes");

  const { me, others } = await getRecipeOwnerSuggestions();

  return (
    <RecipeShell>
      <RecipeWizard userId={user.id} me={me} suggestions={others} />
    </RecipeShell>
  );
}
