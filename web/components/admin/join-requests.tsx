"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { decideJoinRequestAction } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormError } from "@/components/ui/page";
import type { PendingRequest } from "@/lib/data";

export function JoinRequests({ requests }: { requests: PendingRequest[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // בקשות נכנסות בזמן שהמנהל מסתכל על המסך
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), 10000);
    return () => clearInterval(timer);
  }, [router]);

  function decide(requestId: string, approve: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await decideJoinRequestAction(requestId, approve);
      if (result.error) setError(result.error);
    });
  }

  return (
    <Card className="flex flex-col gap-3">
      <h2 className="font-display text-xl">
        בקשות הצטרפות
        {requests.length > 0 ? (
          <span className="ms-2 rounded-full bg-brand px-2.5 py-0.5 text-sm text-white">
            {requests.length}
          </span>
        ) : null}
      </h2>

      {requests.length === 0 ? (
        <p className="text-sm text-muted">אין בקשות שממתינות לאישור.</p>
      ) : null}

      {requests.map((request) => (
        <div
          key={request.id}
          className="flex flex-wrap items-center gap-2 rounded-card-sm border border-line p-3"
        >
          <span
            className="size-3 flex-none rounded-full"
            style={{ background: request.team.color }}
          />
          <div className="me-auto">
            <p className="font-bold">{request.profile?.full_name ?? "משתתף"}</p>
            <p className="text-sm text-muted">{request.team.name}</p>
          </div>
          <Button
            className="min-h-10 px-4 text-base"
            disabled={pending}
            onClick={() => decide(request.id, true)}
          >
            אישור ✓
          </Button>
          <Button
            variant="quiet"
            className="min-h-10 px-3 text-base"
            disabled={pending}
            onClick={() => decide(request.id, false)}
          >
            דחייה
          </Button>
        </div>
      ))}

      <FormError>{error}</FormError>
    </Card>
  );
}
