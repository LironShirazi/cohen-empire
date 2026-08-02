import { redirect } from "next/navigation";
import { TeamCodeForm } from "@/components/join/join-forms";
import { Card } from "@/components/ui/card";
import { PageHeader, PageShell } from "@/components/ui/page";
import { getMyMembership, getUser } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

export default async function JoinTeamPage(props: PageProps<"/join/team">) {
  const user = await getUser();
  if (!user) redirect("/join");
  if (await getMyMembership()) redirect("/team");

  const { code } = await props.searchParams;
  const gameCode = typeof code === "string" ? code : "";
  if (!/^\d{6}$/.test(gameCode)) redirect("/join");

  const supabase = await createClient();
  const { data: race } = await supabase
    .from("races")
    .select("id, name")
    .eq("game_code", gameCode)
    .in("status", ["open", "live"])
    .maybeSingle();

  if (!race) redirect("/join");

  return (
    <PageShell>
      <PageHeader title="👥 קוד הקבוצה" back="/join" backLabel="לקוד המשחק" />

      <Card className="flex flex-col gap-5">
        <p className="text-center text-lg font-semibold">{race.name}</p>
        <TeamCodeForm gameCode={gameCode} />
      </Card>
    </PageShell>
  );
}
