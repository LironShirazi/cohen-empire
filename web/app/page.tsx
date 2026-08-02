import { Countdown } from "@/components/countdown";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

// זמני, עד שיהיה מירוץ אמיתי ב-DB (races.starts_at):
// יום העצמאות תשפ"ז — ערך משוער לספירה לאחור בשלב השלד
const NEXT_RACE_AT = "2027-05-12T09:00:00+03:00";

export default async function Home() {
  const user = isSupabaseConfigured
    ? (await (await createClient()).auth.getUser()).data.user
    : null;

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-10 px-6 py-12 text-center">
      <header className="flex flex-col items-center gap-3">
        <span className="text-6xl">🏁</span>
        <h1 className="font-display text-4xl text-brand sm:text-5xl">
          המירוץ למיליון
        </h1>
        <p className="text-lg text-muted">אימפריית כהן · מסורת של 20+ שנה</p>
      </header>

      <section className="flex flex-col items-center gap-4">
        <h2 className="text-sm font-bold tracking-wide text-muted">
          המירוץ הבא בעוד
        </h2>
        <Countdown target={NEXT_RACE_AT} />
      </section>

      <Card className="w-full max-w-sm">
        <div className="flex flex-col gap-3">
          {user ? (
            <>
              <p className="text-lg font-semibold">
                שלום, {(user.user_metadata.full_name as string) ?? user.email} 👋
              </p>
              <SignOutButton />
            </>
          ) : isSupabaseConfigured ? (
            <GoogleSignInButton />
          ) : (
            <Button size="lg" disabled>
              התחברות עם Google — בקרוב
            </Button>
          )}
          <Button variant="secondary" disabled>
            יש לי קוד משחק
          </Button>
        </div>
        <p className="mt-4 text-sm text-muted">
          האפליקציה בבנייה — שלב 0 מתוך{" "}
          <span className="font-semibold">תוכנית הפיתוח</span> 🚧
        </p>
      </Card>
    </main>
  );
}
