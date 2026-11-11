"use client";

import { useState } from "react";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Sheet } from "@/components/ui/sheet";

/**
 * מי שלא מחובר (6f): רואה **שיש** סטוריז — עיגולים מטושטשים, מזמין
 * להתחבר — אבל לא מי ולא מה. מהשרת מגיע מספר בלבד
 * (`count_active_story_users`), ולכן העיגולים כאן ריקים בכוונה: אין
 * שמות או תמונות לטשטש, כי הם בכלל לא הגיעו לדפדפן.
 */
export function LockedStoriesBar({ count }: { count: number }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`יש סטוריז מהמשפחה — התחברו כדי לצפות`}
        className="-mx-5 -mt-8 mb-4 flex w-[calc(100%+2.5rem)] cursor-pointer gap-2.5 overflow-hidden border-b border-white/10 px-3.5 pt-1.5 pb-3.5 md:-mt-14"
      >
        {Array.from({ length: Math.min(count, 6) }, (_, i) => (
          <span key={i} aria-hidden className="flex w-[68px] flex-none flex-col items-center gap-1.5 opacity-55 blur-[2.5px]">
            <span className="block rounded-full bg-white/30 p-[3px]">
              <span className="block size-[58px] rounded-full border-[2.5px] border-navy bg-story-avatar" />
            </span>
            <span className="h-2.5 w-11 rounded-full bg-white/40" />
          </span>
        ))}
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} label="הסטוריז — רק למשפחה" className="text-center">
        <Icon name="lock" size={44} className="mx-auto text-brand" />
        <h2 className="mt-1.5 font-display text-h2">הסטוריז — רק למשפחה</h2>
        <p className="mx-auto mt-2 max-w-[300px] text-small text-muted">
          כדי לצפות ברגעים של כולם ולשתף משלכם, התחברו עם חשבון Google. כך
          כולם יודעים מי צילם, ומי שהעלה רואה מי צפה.
        </p>
        <div className="mt-5">
          <GoogleSignInButton next="/" className="w-full" />
        </div>
        <Button variant="quiet" className="mt-1.5 w-full" onClick={() => setOpen(false)}>
          אולי אחר כך
        </Button>
      </Sheet>
    </>
  );
}
