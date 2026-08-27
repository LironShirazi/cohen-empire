import Link from "next/link";
import { redirect } from "next/navigation";
import { GameCodeForm } from "@/components/join/join-forms";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { PageShell } from "@/components/ui/page";
import { getMyJoinRequest, getMyMembership, getUser } from "@/lib/data";

export default async function JoinPage() {
  const user = await getUser();

  if (user) {
    if (await getMyMembership()) redirect("/team");
    const request = await getMyJoinRequest();
    if (request?.status === "pending") redirect("/waiting");
  }

  return (
    <PageShell className="flex flex-col items-center gap-4 pt-10 text-center">
      <Chip>שלב 1 מתוך 3</Chip>

      {/* המצפן — סימן הניווט של המותג (foundations/brand.html) */}
      <div className="compass size-24 p-[9px]">
        <span className="compass-core text-4xl">🌍</span>
      </div>

      {user ? (
        <>
          <h1 className="font-display text-h1">מה קוד המשחק?</h1>
          <p className="-mt-2 text-small text-muted">
            המנהל התורן מציג אותו בענק — כמו בקהוט
          </p>
          <GameCodeForm />
        </>
      ) : (
        <>
          <h1 className="font-display text-h1">כניסה למשחק</h1>
          <Card className="flex w-full flex-col gap-4">
            <p className="text-lg">
              קודם מתחברים עם Google, ואז מזינים את קוד המשחק 🏁
            </p>
            <GoogleSignInButton next="/join" />
          </Card>
        </>
      )}

      <Link
        href="/"
        className="mt-auto text-small font-bold text-muted hover:text-brand"
      >
        → לדף הבית
      </Link>
    </PageShell>
  );
}
