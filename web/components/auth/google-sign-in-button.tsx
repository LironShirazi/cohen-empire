"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button, type ButtonProps } from "@/components/ui/button";

export function GoogleSignInButton({
  next,
  ...props
}: ButtonProps & { next?: string }) {
  const [loading, setLoading] = useState(false);

  // "אחורה" מ-Google משחזר את העמוד מה-bfcache עם loading=true — בלי זה
  // הכפתור נשאר מושבת ("כפתור מת") עד רענון
  useEffect(() => {
    const reset = (e: PageTransitionEvent) => {
      if (e.persisted) setLoading(false);
    };
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);

  async function handleSignIn() {
    setLoading(true);

    // הזרימה שלנו (app/auth/google) — במסך של Google מופיע הדומיין של
    // האפליקציה ולא <project-ref>.supabase.co
    if (process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID) {
      const start = new URL("/auth/google", window.location.origin);
      if (next) start.searchParams.set("next", next);
      window.location.assign(start);
      return;
    }

    // בלי Client ID (פיתוח מקומי) — הזרימה הרגילה של Supabase
    const supabase = createClient();
    const callback = new URL("/auth/callback", window.location.origin);
    if (next) callback.searchParams.set("next", next);
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callback.toString() },
    });
  }

  return (
    <Button size="lg" onClick={handleSignIn} disabled={loading} {...props}>
      {loading ? "מעביר ל-Google…" : "התחברות עם Google"}
    </Button>
  );
}
