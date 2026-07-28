import { ButtonLink } from "@/components/ui/Button";
import { Countdown } from "@/components/Countdown";
import { QuoteRotator } from "@/components/QuoteRotator";
import { NEXT_RACE_FALLBACK } from "@/lib/config";

const quickLinks = [
  { href: "/hall-of-fame", emoji: "🏆", label: "היכל התהילה" },
  { href: "/gallery", emoji: "📸", label: "גלריה" },
  { href: "/teams", emoji: "👥", label: "הקבוצות שלי" },
];

export default function Home() {
  const race = NEXT_RACE_FALLBACK;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col items-center gap-10 px-4 py-10">
      <header className="text-center">
        <p className="text-lg font-bold text-gold">🏁 אימפריית כהן</p>
        <h1 className="mt-1 text-4xl font-black text-ink sm:text-5xl">
          המירוץ למיליון
        </h1>
        <p className="mt-3 text-ink-soft">
          מסורת משפחתית של יותר מ-20 שנה — כל יום העצמאות, מהזינוק ועד הסיום
          בבית של סבא וסבתא ז״ל
        </p>
      </header>

      <section className="w-full text-center" aria-label="ספירה לאחור">
        <h2 className="mb-4 text-xl font-bold text-ink">
          {race.name} יוצא לדרך בעוד
        </h2>
        <Countdown target={race.startsAt} />
      </section>

      <ButtonLink href="/join" className="w-full max-w-xs text-xl">
        כניסה למשחק 🎮
      </ButtonLink>

      <QuoteRotator />

      <nav className="grid w-full grid-cols-3 gap-3" aria-label="קישורים">
        {quickLinks.map((link) => (
          <ButtonLink
            key={link.href}
            href={link.href}
            variant="secondary"
            className="flex-col rounded-card !px-2 py-4 text-base"
          >
            <span className="text-2xl">{link.emoji}</span>
            {link.label}
          </ButtonLink>
        ))}
      </nav>
    </main>
  );
}
