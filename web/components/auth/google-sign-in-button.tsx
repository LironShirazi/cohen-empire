"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button, type ButtonProps } from "@/components/ui/button";

export function GoogleSignInButton(props: ButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleSignIn() {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  return (
    <Button size="lg" onClick={handleSignIn} disabled={loading} {...props}>
      {loading ? "מעביר ל-Google…" : "התחברות עם Google"}
    </Button>
  );
}
