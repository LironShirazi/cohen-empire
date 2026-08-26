"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, type ButtonProps } from "@/components/ui/button";

export function SignOutButton({
  variant = "secondary",
  ...props
}: Omit<ButtonProps, "onClick" | "disabled">) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.refresh();
  }

  return (
    <Button
      variant={variant}
      onClick={handleSignOut}
      disabled={loading}
      {...props}
    >
      {loading ? "מתנתק…" : "התנתקות"}
    </Button>
  );
}
