import { redirect } from "next/navigation";
import { PlayScreen } from "@/components/game/play-screen";
import { Card } from "@/components/ui/card";
import { PageHeader, PageShell } from "@/components/ui/page";
import { getMyMembership, getUser } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import type { GameState } from "@/lib/supabase/types";

export default async function PlayPage() {
  const user = await getUser();
  if (!user) redirect("/join");

  const membership = await getMyMembership();
  if (!membership) redirect("/join");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_team_state", {
    p_team_id: membership.team.id,
  });

  return (
    <PageShell>
      <PageHeader title="🧭 מהלך המשחק" back="/team" backLabel="לקבוצה" />

      {error ? (
        <Card className="text-center">
          <p className="font-bold text-brand">לא הצלחנו לטעון את מצב המשחק</p>
          <p className="mt-1 text-sm text-muted">{error.message}</p>
        </Card>
      ) : (
        <PlayScreen state={data as GameState} />
      )}
    </PageShell>
  );
}
