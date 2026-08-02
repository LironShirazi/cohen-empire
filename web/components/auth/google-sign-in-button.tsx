"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button, type ButtonProps } from "@/components/ui/button";

export function GoogleSignInButton({
  next,
  ...props
}: ButtonProps & { next?: string }) {
  const [loading, setLoading] = useState(false);

  async function handleSignIn() {
    setLoading(true);
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
