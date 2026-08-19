import Link from "next/link";
import { Countdown } from "@/components/countdown";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import {
  getFeaturedRace,
  getMyAdminRaces,
  getMyJoinRequest,
  getMyMembership,
  getProfile,
  getUser,
} from "@/lib/data";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default async function Home() {
  const user = await getUser();

  const [race, membership, request, adminRaces, profile] = await Promise.all([
    getFeaturedRace(),
    user ? getMyMembership() : null,
    user ? getMyJoinRequest() : null,
    user ? getMyAdminRaces() : [],
    user ? getProfile() : null,
  ]);

  const showAdminLink = adminRaces.length > 0 || profile?.is_owner;

  // לאן הכפתור הראשי מוביל תלוי במצב של המשתמש הזה בדיוק
  const primary = membership
    ? { href: "/team", label: "לקבוצה שלי 🏁" }
    : request?.status === "pending"
      ? { href: "/waiting", label: "הבקשה שלכם ממתינה ⏳" }
      : { href: "/join", label: "כניסה למשחק" };

  return (
    <main className="flex flex-1 flex-col items-center gap-8 px-6 py-10 text-center">
      <header className="flex flex-col items-center gap-3">
        <span className="text-6xl">🏁</span>
        <h1 className="font-display text-4xl text-brand sm:text-5xl">
          המירוץ למיליון
        </h1>
        <p className="text-lg text-muted">אימפריית כהן · מסורת של 20+ שנה</p>
      </header>

      <section className="flex flex-col items-center gap-4">
        {race?.starts_at ? (
          <>
            <h2 className="text-sm font-bold tracking-wide text-muted">
              {race.status === "live" ? "המירוץ בעיצומו" : `${race.name} — בעוד`}
            </h2>
            <Countdown target={race.starts_at} />
          </>
        ) : (
          <p className="text-muted">
            עוד לא נקבע תאריך למירוץ הבא — תכף מעדכנים 🗓️
          </p>
        )}

        {race?.status === "live" ? <Chip tone="brand">🔴 רץ עכשיו</Chip> : null}
      </section>

      <Card className="flex w-full max-w-sm flex-col gap-3">
        {user ? (
          <>
            <p className="text-lg font-semibold">
              שלום, {profile?.full_name ?? user.email} 👋
            </p>
            <Link href={primary.href}>
              <Button size="lg" className="w-full">
                {primary.label}
              </Button>
            </Link>
            <SignOutButton />
          </>
        ) : isSupabaseConfigured ? (
          <>
            <p>מתחברים עם Google ואז מזינים את קוד המשחק 🔑</p>
            <GoogleSignInButton next="/join" />
          </>
        ) : (
          <Button size="lg" disabled>
            התחברות עם Google — בקרוב
          </Button>
        )}
      </Card>

      <nav className="flex w-full max-w-sm flex-col gap-3">
        {user ? (
          <div className="grid grid-cols-2 gap-3">
            <Link href="/leaderboard">
              <Button variant="navy" className="w-full">
                🏅 לוח מובילים
              </Button>
            </Link>
            <Link href="/teams">
              <Button variant="accent" className="w-full">
                👥 הקבוצות
              </Button>
            </Link>
          </div>
        ) : null}

        {/* העץ המשפחתי — ראוט באפליקציה מאז שלב 3 (docs/06) */}
        <Link href="/family-tree">
          <Button variant="secondary" className="w-full">
            🌳 העץ המשפחתי
          </Button>
        </Link>

        {showAdminLink ? (
          <Link href="/admin">
            <Button variant="quiet" className="w-full">
              🛠️ ניהול המירוץ
            </Button>
          </Link>
        ) : null}
      </nav>
    </main>
  );
}
