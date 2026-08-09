"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * מרענן את מסך ההמתנה כשהמנהל מחליט על הבקשה.
 * Realtime הוא המסלול המהיר; הרענון כל 15 שניות הוא רשת ביטחון
 * לקליטה חלשה בשטח, שבה ה-WebSocket עלול ליפול בלי להתאושש מיד.
 */
export function WaitingWatcher({ requestId }: { requestId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`join-request-${requestId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "join_requests",
          filter: `id=eq.${requestId}`,
        },
        () => router.refresh()
      )
      .subscribe();

    const poll = setInterval(() => router.refresh(), 15000);

    return () => {
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [requestId, router]);

  return null;
}
