"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormError } from "@/components/ui/page";
import { createClient } from "@/lib/supabase/client";

/**
 * פתיחת אלבום חדש. כותב ישירות מול RLS (`gallery_albums_insert`),
 * שמוודאת ש-`created_by` הוא המשתמש עצמו.
 *
 * הטופס נפתח רק בלחיצה — בדף שכולו אלבומים, שדה קלט פתוח בראש המסך
 * גונב את תשומת הלב מהאלבומים עצמם.
 */
export function NewAlbumForm({ myUserId }: { myUserId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    const value = name.trim();
    if (!value) return setError("צריך שם לאלבום");

    setBusy(true);
    setError(null);
    const { data, error: insertError } = await createClient()
      .from("gallery_albums")
      .insert({ name: value, created_by: myUserId })
      .select("id")
      .single();
    setBusy(false);

    if (insertError) return setError(insertError.message);
    router.push(`/gallery/${data.id}`);
  }

  if (!open) {
    return (
      <Button size="lg" className="w-full" onClick={() => setOpen(true)}>
        ➕ אלבום חדש
      </Button>
    );
  }

  return (
    <Card className="flex flex-col gap-3">
      <label className="text-sm font-bold text-muted" htmlFor="album-name">
        איך נקרא לאלבום?
      </label>
      <input
        id="album-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") void create();
        }}
        maxLength={60}
        autoFocus
        placeholder="למשל: החתונה של נועה ואיתי"
        className="min-h-12 w-full rounded-card-sm border-2 border-line bg-surface px-3 text-[17px]"
      />
      <div className="flex gap-2">
        <Button className="flex-1" disabled={busy} onClick={() => void create()}>
          {busy ? "פותח..." : "פתיחת האלבום"}
        </Button>
        <Button
          variant="secondary"
          className="flex-1"
          disabled={busy}
          onClick={() => {
            setOpen(false);
            setName("");
            setError(null);
          }}
        >
          ביטול
        </Button>
      </div>
      <FormError>{error}</FormError>
    </Card>
  );
}
