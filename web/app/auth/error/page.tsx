import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function AuthErrorPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-12 text-center">
      <span className="text-5xl">😕</span>
      <h1 className="text-2xl font-bold text-primary">ההתחברות נכשלה</h1>
      <Card className="w-full max-w-sm">
        <p className="text-foreground/70">
          משהו השתבש בהתחברות עם Google. אפשר לנסות שוב.
        </p>
        <Link href="/">
          <Button className="mt-4 w-full">חזרה לדף הבית</Button>
        </Link>
      </Card>
    </main>
  );
}
