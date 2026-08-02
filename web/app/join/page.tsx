import { redirect } from "next/navigation";
import { GameCodeForm } from "@/components/join/join-forms";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { Card } from "@/components/ui/card";
import { PageHeader, PageShell } from "@/components/ui/page";
import { getMyJoinRequest, getMyMembership, getUser } from "@/lib/data";

export default async function JoinPage() {
  const user = await getUser();

  if (user) {
    if (await getMyMembership()) redirect("/team");
    const request = await getMyJoinRequest();
    if (request?.status === "pending") redirect("/waiting");
  }

  return (
    <PageShell>
      <PageHeader title="🔑 כניסה למשחק" back="/" backLabel="לדף הבית" />

      <Card className="flex flex-col gap-5">
        {user ? (
          <>
            <h2 className="text-center font-display text-xl">קוד המשחק</h2>
            <GameCodeForm />
          </>
        ) : (
          <>
            <p className="text-center text-lg">
              קודם מתחברים עם Google, ואז מזינים את קוד המשחק 🏁
            </p>
            <GoogleSignInButton next="/join" />
          </>
        )}
      </Card>
    </PageShell>
  );
}
