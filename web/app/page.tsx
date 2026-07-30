import { Countdown } from "@/components/countdown";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

// זמני, עד שיהיה מירוץ אמיתי ב-DB (races.starts_at):
// יום העצמאות תשפ"ז — ערך משוער לספירה לאחור בשלב השלד
const NEXT_RACE_AT = "2027-05-12T09:00:00+03:00";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-10 px-6 py-12 text-center">
      <header className="flex flex-col items-center gap-3">
        <span className="text-6xl">🏁</span>
        <h1 className="text-4xl font-bold text-primary sm:text-5xl">
          המירוץ למיליון
        </h1>
        <p className="text-lg text-foreground/70">אימפריית כהן · מסורת של 20+ שנה</p>
      </header>

      <section className="flex flex-col items-center gap-4">
        <h2 className="text-sm font-semibold tracking-wide text-foreground/60">
          המירוץ הבא בעוד
        </h2>
        <Countdown target={NEXT_RACE_AT} />
      </section>

      <Card className="w-full max-w-sm">
        <div className="flex flex-col gap-3">
          <Button size="lg" disabled>
            התחברות עם Google — בקרוב
          </Button>
          <Button variant="outline" disabled>
            יש לי קוד משחק
          </Button>
        </div>
        <p className="mt-4 text-sm text-foreground/60">
          האפליקציה בבנייה — שלב 0 מתוך{" "}
          <span className="font-semibold">תוכנית הפיתוח</span> 🚧
        </p>
      </Card>
    </main>
  );
}
