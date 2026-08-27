import Link from "next/link";
import { redirect } from "next/navigation";
import { TeamCodeForm } from "@/components/join/join-forms";
import { Chip } from "@/components/ui/chip";
import { PageShell } from "@/components/ui/page";
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
    <PageShell className="flex flex-col items-center gap-4 pt-10 text-center">
      <Chip>שלב 2 מתוך 3</Chip>
      <h1 className="mt-1.5 font-display text-h1">מה קוד הקבוצה שלכם?</h1>
      <p className="-mt-2 text-small text-muted">
        ספרה אחת או שתיים — קיבלתם מהמנהל התורן
      </p>
      <p className="text-lg font-semibold">{race.name}</p>

      <TeamCodeForm gameCode={gameCode} />

      <Link
        href="/join"
        className="mt-auto text-small font-bold text-muted hover:text-brand"
      >
        → לקוד המשחק
      </Link>
    </PageShell>
  );
}
