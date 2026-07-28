import { ButtonLink } from "@/components/ui/Button";

export function ComingSoon({ emoji, title }: { emoji: string; title: string }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col items-center justify-center gap-6 px-4 text-center">
      <span className="text-6xl">{emoji}</span>
      <h1 className="text-3xl font-black text-ink">{title}</h1>
      <p className="text-ink-soft">המסך הזה בבנייה — מגיע בקרוב 🚧</p>
      <ButtonLink href="/" variant="secondary">
        ← חזרה לדף הבית
      </ButtonLink>
    </main>
  );
}
