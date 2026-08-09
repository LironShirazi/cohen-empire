"use client";

import { useState, useTransition } from "react";
import {
  assignStationOrderAction,
  setTeamStationOrderAction,
} from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormError } from "@/components/ui/page";
import type { TeamOrder } from "@/lib/data";

/**
 * סדר התחנות (docs/01-requirements.md §4).
 *
 * הסדר הידני נעשה בחיצים ולא בגרירה: על מסך טלפון, ביד אחת ובשמש,
 * חיצים הם פשוט אמינים יותר — ונגישים גם למקלדת ולקורא מסך.
 */
export function StationOrder({
  raceId,
  orders,
  locked,
}: {
  raceId: string;
  orders: TeamOrder[];
  locked: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(fn: () => Promise<{ error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (result.error) setError(result.error);
    });
  }

  function move(order: TeamOrder, index: number, direction: -1 | 1) {
    const ids = order.stations.map((station) => station.id);
    const target = index + direction;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    run(() => setTeamStationOrderAction(order.team.id, ids));
  }

  return (
    <Card className="flex flex-col gap-3">
      <h2 className="font-display text-xl">סדר התחנות</h2>

      {locked ? (
        <p className="text-sm text-muted">
          המירוץ כבר יצא לדרך — אי אפשר לשנות סדר תחנות עכשיו.
        </p>
      ) : (
        <>
          <p className="text-sm text-muted">
            סדר אקראי לכל קבוצה מונע שכל הקבוצות ייתקעו יחד באותה תחנה.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="secondary"
              disabled={pending}
              onClick={() => run(() => assignStationOrderAction(raceId, "same"))}
            >
              זהה לכולם
            </Button>
            <Button
              disabled={pending}
              onClick={() => run(() => assignStationOrderAction(raceId, "random"))}
            >
              אקראי לכל קבוצה 🎲
            </Button>
          </div>
          <p className="text-xs text-muted">
            שימו לב: כל חלוקה מחדש מוחקת את הסדר הקיים ובונה אותו מחדש.
          </p>
        </>
      )}

      {orders.map((order) => (
        <div key={order.team.id} className="rounded-card-sm border border-line p-3">
          <p className="mb-2 flex items-center gap-2 font-bold">
            <span
              className="size-3 rounded-full"
              style={{ background: order.team.color }}
            />
            {order.team.name}
          </p>

          {order.stations.length === 0 ? (
            <p className="text-sm text-muted">אין עדיין סדר תחנות לקבוצה הזו.</p>
          ) : (
            <ol className="flex flex-col gap-1.5">
              {order.stations.map((station, index) => (
                <li key={station.id} className="flex items-center gap-2 text-sm">
                  <span className="w-6 text-center font-bold text-muted">
                    {index + 1}
                  </span>
                  <span className="me-auto">{station.name}</span>
                  {locked ? null : (
                    <>
                      <button
                        type="button"
                        className="size-8 rounded-full border border-line disabled:opacity-30"
                        disabled={pending || index === 0}
                        onClick={() => move(order, index, -1)}
                        aria-label={`הזזת ${station.name} למעלה`}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="size-8 rounded-full border border-line disabled:opacity-30"
                        disabled={pending || index === order.stations.length - 1}
                        onClick={() => move(order, index, 1)}
                        aria-label={`הזזת ${station.name} למטה`}
                      >
                        ↓
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      ))}

      <FormError>{error}</FormError>
    </Card>
  );
}
