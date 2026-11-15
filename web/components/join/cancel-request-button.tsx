"use client";

import { useState, useTransition } from "react";
import { cancelJoinRequest } from "@/app/join/actions";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm";
import { FormError } from "@/components/ui/page";

/**
 * "טעיתי בקוד הקבוצה" במסך ההמתנה. `quiet` בכוונה: זו יציאת חירום,
 * לא הפעולה שהמסך מזמין — מי שממתין כמו שצריך לא אמור להתפתות לה.
 *
 * בהצלחה השרת מנווט (redirect) לקוד הקבוצה; עד אז הכפתור עצמו הוא
 * המשוב ("מבטלים…"). פס ההתקדמות לא נדלק כאן — בשגיאה הוא היה נתקע.
 */
export function CancelRequestButton({
  requestId,
  gameCode,
  teamName,
}: {
  requestId: string;
  gameCode: string;
  teamName: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const confirm = useConfirm();

  return (
    <div className="flex w-full flex-col items-center gap-2">
      <Button
        type="button"
        variant="quiet"
        disabled={pending}
        onClick={async () => {
          const ok = await confirm({
            title: "ביטול הבקשה",
            message: `לבטל את הבקשה להצטרף ל${teamName}? אפשר יהיה להזין מיד קוד קבוצה אחר.`,
            confirmLabel: "כן, לבטל",
          });
          if (!ok) return;
          setError(undefined);
          startTransition(async () => {
            const result = await cancelJoinRequest(requestId, gameCode);
            if (result?.error) setError(result.error);
          });
        }}
      >
        {pending ? "מבטלים…" : "טעיתי בקבוצה — ביטול הבקשה"}
      </Button>
      <FormError>{error}</FormError>
    </div>
  );
}
