import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getUser } from "@/lib/data";
import type { Story } from "@/lib/supabase/types";
import {
  STORIES_BUCKET,
  type StoryFeed,
  type StoryGroup,
  type StoryViewer,
} from "@/lib/stories";

type Identity = {
  name: string;
  avatar_url: string | null;
  avatar_source: "tree" | "google" | null;
};

/**
 * הפס של דף הבית (0024): כל מי שיש לו סטורי חי, ואני בנפרד.
 *
 * שם ותמונה **מהעץ** (עלה עם `profile_id`) ואם אין — מפרופיל ה-Google.
 * הם לא נשמרים בשורת הסטורי, ולכן שינוי תמונה בעץ מתעדכן מיד בפס.
 *
 * הסדר: מי שיש לו משהו שלא ראיתי קודם (החדש ביותר ראשון), ואחריהם
 * מי שכבר נצפה — כמו באינסטגרם. 24 השעות מסוננות כבר ב-RLS.
 */
export async function getStoryFeed(): Promise<StoryFeed | null> {
  if (!isSupabaseConfigured) return null;
  const user = await getUser();
  if (!user) return null;
  const supabase = await createClient();

  const { data: storyRows } = await supabase
    .from("stories")
    .select("*")
    .order("created_at", { ascending: true });
  const stories = (storyRows ?? []) as Story[];

  const userIds = [...new Set([user.id, ...stories.map((s) => s.user_id)])];
  const myStoryIds = stories.filter((s) => s.user_id === user.id).map((s) => s.id);

  const [{ data: profiles }, { data: leaves }, { data: myViews }, { data: viewsOfMine }] =
    await Promise.all([
      supabase.from("profiles").select("id, full_name, avatar_url").in("id", userIds),
      supabase
        .from("family_members")
        .select("profile_id, name, photo_url")
        .in("profile_id", userIds),
      stories.length
        ? supabase
            .from("story_views")
            .select("story_id")
            .eq("viewer_id", user.id)
            .in("story_id", stories.map((s) => s.id))
        : Promise.resolve({ data: [] }),
      myStoryIds.length
        ? supabase
            .from("story_views")
            .select("story_id, viewer_id, viewed_at")
            .in("story_id", myStoryIds)
            .order("viewed_at", { ascending: false })
        : Promise.resolve({ data: [] }),
    ]);

  // הצופים בסטורי שלי לא בהכרח ברשימת המעלים — משלימים את הפרופילים שלהם
  const viewerIds = [
    ...new Set(
      ((viewsOfMine ?? []) as { viewer_id: string }[])
        .map((v) => v.viewer_id)
        .filter((id) => !userIds.includes(id))
    ),
  ];
  const [{ data: viewerProfiles }, { data: viewerLeaves }] = viewerIds.length
    ? await Promise.all([
        supabase.from("profiles").select("id, full_name, avatar_url").in("id", viewerIds),
        supabase
          .from("family_members")
          .select("profile_id, name, photo_url")
          .in("profile_id", viewerIds),
      ])
    : [{ data: [] }, { data: [] }];

  const identities = new Map<string, Identity>();
  for (const p of [...(profiles ?? []), ...(viewerProfiles ?? [])] as {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  }[]) {
    identities.set(p.id, {
      name: p.full_name?.trim() || "בן משפחה",
      avatar_url: p.avatar_url,
      avatar_source: p.avatar_url ? "google" : null,
    });
  }
  for (const leaf of [...(leaves ?? []), ...(viewerLeaves ?? [])] as {
    profile_id: string;
    name: string;
    photo_url: string | null;
  }[]) {
    const base = identities.get(leaf.profile_id);
    identities.set(leaf.profile_id, {
      name: leaf.name?.trim() || base?.name || "בן משפחה",
      avatar_url: leaf.photo_url ?? base?.avatar_url ?? null,
      avatar_source: leaf.photo_url ? "tree" : (base?.avatar_source ?? null),
    });
  }
  const who = (id: string): Identity =>
    identities.get(id) ?? { name: "בן משפחה", avatar_url: null, avatar_source: null };

  const seenIds = new Set(((myViews ?? []) as { story_id: string }[]).map((v) => v.story_id));

  const viewers: Record<string, StoryViewer[]> = {};
  for (const v of (viewsOfMine ?? []) as {
    story_id: string;
    viewer_id: string;
    viewed_at: string;
  }[]) {
    const identity = who(v.viewer_id);
    (viewers[v.story_id] ??= []).push({
      viewer_id: v.viewer_id,
      name: identity.name,
      avatar_url: identity.avatar_url,
      viewed_at: v.viewed_at,
    });
  }

  const groups = new Map<string, StoryGroup>();
  for (const story of stories) {
    let group = groups.get(story.user_id);
    if (!group) {
      group = { user_id: story.user_id, ...who(story.user_id), items: [], seen: true };
      groups.set(story.user_id, group);
    }
    group.items.push({
      id: story.id,
      kind: story.kind,
      storage_path: story.storage_path,
      url: story.storage_path
        ? supabase.storage.from(STORIES_BUCKET).getPublicUrl(story.storage_path).data.publicUrl
        : null,
      caption: story.caption,
      color: story.color,
      created_at: story.created_at,
    });
    if (story.user_id !== user.id && !seenIds.has(story.id)) group.seen = false;
  }

  const mine = groups.get(user.id) ?? null;
  if (mine) mine.viewers = viewers;
  groups.delete(user.id);

  const latest = (g: StoryGroup) => g.items[g.items.length - 1].created_at;
  const others = [...groups.values()].sort((a, b) =>
    a.seen !== b.seen ? (a.seen ? 1 : -1) : latest(b).localeCompare(latest(a))
  );

  return { me: { user_id: user.id, ...who(user.id) }, mine, others };
}

/** מי שלא מחובר: כמה אנשים העלו — בלי מי ובלי מה (0024) */
export async function countActiveStoryUsers(): Promise<number> {
  if (!isSupabaseConfigured) return 0;
  const supabase = await createClient();
  const { data } = await supabase.rpc("count_active_story_users");
  return typeof data === "number" ? data : 0;
}
