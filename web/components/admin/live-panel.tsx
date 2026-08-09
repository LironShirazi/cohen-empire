"use client";

import Image from "next/image";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  adminDecideStationAction,
  adminOpenStationAction,
} from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { FormError } from "@/components/ui/page";
import type { ApprovalRow, TeamPosition } from "@/lib/data";

export function LivePanel({
  approvals,
  positions,
}: {
  approvals: ApprovalRow[];
  positions: TeamPosition[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const timer = setInterval(() => router.refresh(), 8000);
    return () => clearInterval(timer);
  }, [router]);

  function run(fn: () => Promise<{ error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-3">
        <h2 className="font-display text-xl">
          תור אישורי משימות
          {approvals.length > 0 ? (
            <span className="ms-2 rounded-full bg-brand px-2.5 py-0.5 text-sm text-white">
              {approvals.length}
            </span>
          ) : null}
        </h2>

        {approvals.length === 0 ? (
          <p className="text-sm text-muted">אין משימות שממתינות לאישור.</p>
        ) : null}

        {approvals.map((row) => (
          <div
            key={`${row.team_id}-${row.station_id}`}
            className="flex flex-col gap-2 rounded-card-sm border border-line p-3"
          >
            <div className="flex items-center gap-2">
              <span
                className="size-3 flex-none rounded-full"
                style={{ background: row.team.color }}
              />
              <span className="font-bold">{row.team.name}</span>
              <span className="text-sm text-muted">· {row.station.name}</span>
            </div>

            {row.proof_url ? (
              <a href={row.proof_url} target="_blank" rel="noreferrer">
                <Image
                  src={row.proof_url}
                  alt={`הוכחה מ${row.team.name}`}
                  width={400}
                  height={300}
                  unoptimized
                  className="h-40 w-full rounded-card-sm object-cover"
                />
              </a>
            ) : null}

            <div className="flex gap-2">
              <Button
                className="min-h-10 flex-1 text-base"
                disabled={pending}
                onClick={() =>
                  run(() =>
                    adminDecideStationAction(row.team_id, row.station_id, true)
                  )
                }
              >
                אישור ✓
              </Button>
              <Button
                variant="quiet"
                className="min-h-10 px-3 text-base"
                disabled={pending}
                onClick={() =>
                  run(() =>
                    adminDecideStationAction(row.team_id, row.station_id, false)
                  )
                }
              >
                עוד לא
              </Button>
            </div>
          </div>
        ))}
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="font-display text-xl">איפה כל קבוצה</h2>
        <p className="text-sm text-muted">
          למנהל מותר לראות הכל — למשתתפים הלידרבורד מראה דירוג בלבד.
        </p>

        {positions.map((row) => (
          <div
            key={row.team.id}
            className="flex flex-wrap items-center gap-2 rounded-card-sm border border-line p-3"
          >
            <span
              className="size-3 flex-none rounded-full"
              style={{ background: row.team.color }}
            />
            <div className="me-auto">
              <p className="font-bold">{row.team.name}</p>
              <p className="text-sm text-muted">
                {row.station
                  ? `תחנה ${row.position} · ${row.station.name}`
                  : "סיימו הכל 🏁"}
              </p>
            </div>

            {row.station ? (
              row.arrived ? (
                <Chip tone="ok">בתחנה</Chip>
              ) : (
                <Button
                  variant="secondary"
                  className="min-h-10 px-3 text-base"
                  disabled={pending}
                  onClick={() =>
                    run(() => adminOpenStationAction(row.team.id, row.station!.id))
                  }
                >
                  פתח ידנית 🔓
                </Button>
              )
            ) : null}
          </div>
        ))}
      </Card>

      <FormError>{error}</FormError>
    </div>
  );
}
