import Link from "next/link";
import { QuoteCard } from "@/components/family/quote-card";
import { HomeHero } from "@/components/home/hero";
import { WalkerBand } from "@/components/home/walker-band";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  getFeaturedRace,
  getMyAdminRaces,
  getMyJoinRequest,
  getMyMembership,
  getProfile,
  getRandomQuote,
  getUser,
} from "@/lib/data";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/** אריח ניווט — ‎.card.card-tight בסקיצה 1a */
function Tile({
  href,
  icon,
  label,
}: {
  href: string;
  icon: string;
  label: string;
}) {
  return (
    <Link href={href} className="flex-1">
      <Card tight className="px-1.5 py-3.5 text-center">
        <span className="block text-[26px]">{icon}</span>
        <span className="mt-0.5 block text-small font-bold">{label}</span>
      </Card>
    </Link>
  );
}

export default async function Home() {
  const user = await getUser();

  const [race, membership, request, adminRaces, profile, quote] =
    await Promise.all([
      getFeaturedRace(),
      user ? getMyMembership() : null,
      user ? getMyJoinRequest() : null,
      user ? getMyAdminRaces() : [],
      user ? getProfile() : null,
      // `quotes` היא `to authenticated` מאז 0001 — למי שלא מחובר
      // השאילתה תמיד תחזור ריקה, ואין טעם לשלוח אותה
      user ? getRandomQuote() : null,
    ]);

  const showAdminLink = adminRaces.length > 0 || profile?.is_owner;

  // לאן הכפתור הראשי מוביל תלוי במצב של המשתמש הזה בדיוק
  const primary = membership
    ? { href: "/team", label: "לקבוצה שלי 🏁" }
    : request?.status === "pending"
      ? { href: "/waiting", label: "הבקשה שלכם ממתינה ⏳" }
      : { href: "/join", label: "כניסה למשחק 🏁" };

  return (
    <main className="flex flex-1 flex-col">
      <HomeHero
        race={race}
        action={
          user ? (
            <Link href={primary.href}>
              <Button variant="accent" size="lg" className="w-full">
                {primary.label}
              </Button>
            </Link>
          ) : isSupabaseConfigured ? (
            <GoogleSignInButton variant="accent" next="/join" />
          ) : (
            <Button variant="accent" size="lg" className="w-full" disabled>
              התחברות עם Google — בקרוב
            </Button>
          )
        }
      />

      {/* דף הבית הוא המסך שגם נפתח ממחשב (בן משפחה שמחפש את הגלריה
          או את העץ), ולכן העמודה מתרחבת — אבל הכפתורים הגדולים
          נשארים ברוחב כף יד גם שם */}
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-3.5 px-5 pt-4.5 pb-2 md:max-w-3xl">
        <QuoteCard quote={quote} variant="feature" />

        {/* מירוץ שהסתיים — ההכרזה היא הדבר הראשון שרוצים לראות,
            גם כמה ימים אחרי (מסך הזוכים הוא ראוט קבוע, לא רגע) */}
        {user && race?.status === "finished" ? (
          <Link href="/winners" className="w-full self-center md:max-w-sm">
            <Button variant="accent" size="lg" className="w-full">
              🏆 מסך הזוכים
            </Button>
          </Link>
        ) : null}

        {/* קבועים בדף הבית ללא קשר למהלך המשחק (docs/04 §1).
            הסקיצה מראה שלושה אריחים ומשמיטה את העץ; docs/04 §1 מונה
            אותו במפורש, והוא מאוחר יותר — ולכן הוא כאן. */}
        {/* ⚠️ `md:contents` ולא עוד עטיפה: בנייד אלה שתי שורות (שלושה
            אריחים ואז שניים), ובמחשב שתי השורות **נעלמות** והאריחים
            הופכים לפריטים של אותו grid — שורה אחת. בלי זה השורה
            השנייה הייתה נמתחת לשני אריחי ענק.
            מספר העמודות נגזר מהמשתמש ולא קבוע: למי שלא מחובר יש
            שלושה אריחים, ו-grid של חמישה היה משאיר לו חור */}
        <div
          className={`flex flex-col gap-2.5 md:grid ${
            user ? "md:grid-cols-5" : "md:grid-cols-3"
          }`}
        >
          <div className="flex gap-2.5 md:contents">
            <Tile href="/hall-of-fame" icon="🏆" label="היכל התהילה" />
            <Tile href="/gallery" icon="📸" label="גלריה" />
            <Tile href="/family-tree" icon="🌳" label="העץ המשפחתי" />
          </div>

          {user ? (
            <div className="flex gap-2.5 md:contents">
              <Tile href="/leaderboard" icon="🏅" label="לוח מובילים" />
              <Tile href="/teams" icon="👥" label="הקבוצות" />
            </div>
          ) : null}
        </div>

        {showAdminLink ? (
          <Link href="/admin" className="w-full self-center md:max-w-sm">
            <Button variant="quiet" className="w-full">
              🛠️ ניהול המירוץ
            </Button>
          </Link>
        ) : null}

        {user ? (
          <div className="text-center">
            <p className="text-small text-muted">
              שלום, {profile?.full_name ?? user.email} 👋
            </p>
            <SignOutButton variant="quiet" />
          </div>
        ) : null}

        <WalkerBand />
      </div>
    </main>
  );
}
