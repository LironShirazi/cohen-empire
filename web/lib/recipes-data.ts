import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getUser } from "@/lib/data";
import type { Recipe, RecipeQuestion } from "@/lib/supabase/types";

/**
 * ספר המתכונים — שאילתות צד-שרת (0023). בקובץ משלו ולא ב-`lib/data.ts`
 * כדי שהאחרון לא יתנפח עוד; אותו כלל — `getUser()` ולא `auth.getUser()`.
 */

/** שורה ברשימה — בלי רכיבים ושלבים, שלא צריך עד שנכנסים למתכון */
export type RecipeListItem = Pick<
  Recipe,
  "id" | "name" | "owner_name" | "servings" | "thumb_url" | "photo_url"
>;

/**
 * כל המתכונים, החדש למעלה. החיפוש רץ בקליינט על הרשימה הזו: מאות
 * שורות של כמה עשרות בתים — זול יותר מסבב רשת על כל אות שמוקלדת.
 */
export async function getRecipes(): Promise<RecipeListItem[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("recipes")
    .select("id, name, owner_name, servings, thumb_url, photo_url")
    .order("created_at", { ascending: false });
  return (data ?? []) as RecipeListItem[];
}

export type RecipeQuestionRow = RecipeQuestion & {
  asker_name: string | null;
  answerer_name: string | null;
};

export type RecipeDetail = Recipe & {
  creator_name: string | null;
  questions: RecipeQuestionRow[];
};

export async function getRecipe(id: string): Promise<RecipeDetail | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();

  const [{ data: recipe }, { data: questions }] = await Promise.all([
    supabase
      .from("recipes")
      .select("*, creator:profiles(full_name)")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("recipe_questions")
      .select(
        "*, asker:profiles!recipe_questions_asked_by_fkey(full_name), answerer:profiles!recipe_questions_answered_by_fkey(full_name)"
      )
      .eq("recipe_id", id)
      .order("created_at", { ascending: true }),
  ]);
  if (!recipe) return null;

  const { creator, ...rest } = recipe as Recipe & {
    creator: { full_name: string | null } | null;
  };

  return {
    ...rest,
    creator_name: creator?.full_name ?? null,
    questions: ((questions ?? []) as (RecipeQuestion & {
      asker: { full_name: string | null } | null;
      answerer: { full_name: string | null } | null;
    })[]).map(({ asker, answerer, ...q }) => ({
      ...q,
      asker_name: asker?.full_name ?? null,
      answerer_name: answerer?.full_name ?? null,
    })),
  };
}

/**
 * הצעות ל"של מי המתכון" (שלב 1): השם שלי, סבא וסבתא מראש העץ, ומי
 * שכבר יש לו מתכונים. ההקלדה החופשית נשארת — אלה קיצורי דרך בלבד.
 */
export async function getRecipeOwnerSuggestions(): Promise<{
  me: string | null;
  others: string[];
}> {
  if (!isSupabaseConfigured) return { me: null, others: [] };
  const supabase = await createClient();
  const user = await getUser();

  const [{ data: roots }, { data: owners }, { data: myLeaf }, { data: profile }] =
    await Promise.all([
      supabase.from("family_members").select("name").eq("is_root", true),
      supabase
        .from("recipes")
        .select("owner_name")
        .order("created_at", { ascending: false })
        .limit(100),
      user
        ? supabase
            .from("family_members")
            .select("name")
            .eq("profile_id", user.id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      user
        ? supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  const me =
    (myLeaf as { name: string } | null)?.name ??
    (profile as { full_name: string | null } | null)?.full_name ??
    null;

  const seen = new Set<string>(me ? [me] : []);
  const others: string[] = [];
  for (const name of [
    ...((roots ?? []) as { name: string }[]).map((r) => r.name),
    ...((owners ?? []) as { owner_name: string }[]).map((r) => r.owner_name),
  ]) {
    const clean = name?.trim();
    if (clean && !seen.has(clean)) {
      seen.add(clean);
      others.push(clean);
    }
    if (others.length >= 5) break;
  }
  return { me, others };
}
