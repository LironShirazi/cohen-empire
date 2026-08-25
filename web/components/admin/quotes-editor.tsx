"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { QuoteCard } from "@/components/family/quote-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormError } from "@/components/ui/page";
import { createClient } from "@/lib/supabase/client";
import { deleteFamilyImage, uploadFamilyImage } from "@/lib/family-content";
import type { Quote } from "@/lib/supabase/types";

const MAX_LEN = 280; // תואם ל-`quotes_text_len` ב-0014
const WHO = ["סבא", "סבתא"] as const;

/**
 * ניהול משפטי סבא וסבתא (docs/04 §5) — למנהל-על בלבד.
 *
 * כותב ישירות מול RLS (`quotes_insert`/`quotes_update`/`quotes_delete`
 * ב-0014, כולן `public.is_owner()`), בלי server action — בדיוק כמו
 * `new-album-form.tsx` ומאותה סיבה: אין מה לאמת מעבר לזהות.
 *
 * ⚠️ **אין כאן תוכן דמה.** המשפטים מגיעים מהמשפחה, וכל משפט שיוצג
 * באפליקציה מיוחס לסבא או לסבתא ז"ל בשמם — מילים מומצאות במקום הזה
 * הן בדיוק סוג הפלייסהולדר שדולף לפרודקשן ונקרא ע"י המשפחה.
 */
export function QuotesEditor({ quotes }: { quotes: Quote[] }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [who, setWho] = useState<string>(WHO[0]);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setOpen(false);
    setText("");
    setWho(WHO[0]);
    setFile(null);
    setError(null);
  }

  async function create() {
    const value = text.trim();
    if (!value) return setError("צריך לכתוב את המשפט");

    setError(null);
    try {
      let imageUrl: string | null = null;
      if (file) {
        setBusy("מעלה תמונה...");
        imageUrl = await uploadFamilyImage(file, "quotes");
      }

      setBusy("שומר...");
      const { error: insertError } = await createClient()
        .from("quotes")
        .insert({ text: value, who, image_url: imageUrl });

      // השורה היא מה שנחשב. אם היא נכשלה — הקובץ שכבר עלה מיותר
      if (insertError) {
        await deleteFamilyImage(imageUrl);
        throw insertError;
      }

      reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "השמירה נכשלה");
    } finally {
      setBusy(null);
    }
  }

  async function remove(quote: Quote) {
    if (!confirm(`למחוק את המשפט "${quote.text.slice(0, 40)}…"?`)) return;

    setBusy("מוחק...");
    setError(null);
    const { error: deleteError } = await createClient()
      .from("quotes")
      .delete()
      .eq("id", quote.id);
    setBusy(null);

    if (deleteError) return setError(deleteError.message);

    // קודם השורה, אחר-כך הקובץ (lib/family-content.ts)
    await deleteFamilyImage(quote.image_url);
    router.refresh();
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-display text-xl">💬 משפטי סבא וסבתא</h2>

      {open ? (
        <Card className="flex flex-col gap-3">
          <label className="text-sm font-bold text-muted" htmlFor="quote-text">
            מה הם היו אומרים?
          </label>
          <textarea
            id="quote-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={MAX_LEN}
            rows={3}
            autoFocus
            className="w-full rounded-card-sm border-2 border-line bg-surface p-3 text-[17px]"
          />
          <span className="-mt-1 text-xs text-muted">
            {text.length}/{MAX_LEN}
          </span>

          <div className="flex gap-2">
            {WHO.map((option) => (
              <Button
                key={option}
                variant={who === option ? "primary" : "secondary"}
                className="flex-1"
                onClick={() => setWho(option)}
              >
                {option === "סבתא" ? "👵" : "👴"} {option}
              </Button>
            ))}
          </div>

          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <Button variant="quiet" onClick={() => fileInput.current?.click()}>
            {file ? `🖼️ ${file.name}` : "🖼️ קריקטורה או תמונה (לא חובה)"}
          </Button>

          <div className="flex gap-2">
            <Button
              className="flex-1"
              disabled={!!busy}
              onClick={() => void create()}
            >
              {busy ?? "הוספת המשפט"}
            </Button>
            <Button
              variant="secondary"
              className="flex-1"
              disabled={!!busy}
              onClick={reset}
            >
              ביטול
            </Button>
          </div>
          <FormError>{error}</FormError>
        </Card>
      ) : (
        <>
          <Button className="w-full" onClick={() => setOpen(true)}>
            ➕ משפט חדש
          </Button>
          <FormError>{error}</FormError>
        </>
      )}

      {quotes.length === 0 ? (
        <Card className="text-center text-muted">
          עוד לא הוזנו משפטים. עד שיהיה כאן משפט אחד לפחות — לא מוצג
          ציטוט בדף הבית ובמסך ההמתנה.
        </Card>
      ) : (
        quotes.map((quote) => (
          <div key={quote.id} className="flex flex-col gap-1.5">
            <QuoteCard quote={quote} />
            <button
              onClick={() => void remove(quote)}
              disabled={!!busy}
              className="self-start px-1 text-sm font-bold text-muted"
            >
              🗑️ מחיקה
            </button>
          </div>
        ))
      )}
    </section>
  );
}
