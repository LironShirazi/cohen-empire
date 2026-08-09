"use client";

import { useRef, useState, useTransition } from "react";
import { completeAction } from "@/app/team/actions";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { FormError } from "@/components/ui/page";
import { createClient } from "@/lib/supabase/client";
import type { CompletionType } from "@/lib/supabase/types";

/**
 * סימון השלמה — הכפתור משתנה לפי סוג התחנה, אבל מי שקובע אם התחנה
 * באמת הושלמה זה complete_station בשרת: הוא קורא את completion_type
 * מהתחנה ומתעלם ממה שהקליינט טוען.
 */
export function CompleteStation({
  teamId,
  stationId,
  completionType,
}: {
  teamId: string;
  stationId: string;
  completionType: CompletionType;
}) {
  const [error, setError] = useState<string | null>(null);
  const [secretCode, setSecretCode] = useState("");
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  function submit(code: string | null, proofUrl: string | null) {
    setError(null);
    startTransition(async () => {
      const result = await completeAction(teamId, code, proofUrl);
      if (!result.ok) setError(result.error ?? "משהו השתבש");
    });
  }

  async function uploadFile(file: File): Promise<string | null> {
    setError(null);
    setUploading(true);
    try {
      const supabase = createClient();
      const extension = file.name.split(".").pop() ?? "jpg";
      // התיקייה היא מזהה הקבוצה — מדיניות ה-Storage מוודאת שאי אפשר
      // להעלות לתיקייה של קבוצה אחרת
      const path = `${teamId}/${stationId}-${Date.now()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("proofs")
        .upload(path, file, { upsert: false });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("proofs").getPublicUrl(path);
      return data.publicUrl;
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "ההעלאה נכשלה — ננסה שוב?"
      );
      return null;
    } finally {
      setUploading(false);
    }
  }

  const busy = pending || uploading;

  if (completionType === "secret_code") {
    return (
      <div className="flex flex-col gap-3">
        <Field
          label="הקוד הסודי שבתחנה"
          value={secretCode}
          onChange={(event) => setSecretCode(event.target.value)}
          placeholder="מה כתוב בפתק?"
          autoComplete="off"
        />
        <FormError>{error}</FormError>
        <Button
          size="lg"
          disabled={busy || secretCode.trim() === ""}
          onClick={() => submit(secretCode, null)}
        >
          {busy ? "בודקים…" : "שולחים את הקוד 🔑"}
        </Button>
      </div>
    );
  }

  if (completionType === "photo_upload") {
    return (
      <div className="flex flex-col gap-3">
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            const url = await uploadFile(file);
            if (url) submit(null, url);
          }}
        />
        <FormError>{error}</FormError>
        <Button size="lg" disabled={busy} onClick={() => fileInput.current?.click()}>
          {busy ? "מעלים…" : "צלמו והעלו תמונה 📸"}
        </Button>
      </div>
    );
  }

  if (completionType === "admin_approve") {
    return (
      <div className="flex flex-col gap-3">
        {/* תמונה היא רשות כאן — היא נכנסת לתור האישורים של המנהל
            יחד עם הבקשה (docs/04-screens-ux.md §4) */}
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            const url = await uploadFile(file);
            if (url) setProofUrl(url);
          }}
        />

        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => fileInput.current?.click()}
        >
          {uploading
            ? "מעלים…"
            : proofUrl
              ? "התמונה צורפה ✓ — להחלפה"
              : "צירוף תמונה (רשות) 📸"}
        </Button>

        <FormError>{error}</FormError>
        <Button size="lg" disabled={busy} onClick={() => submit(null, proofUrl)}>
          {pending ? "שולחים…" : "סיימנו! בקשו אישור מהמנהל ✋"}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <FormError>{error}</FormError>
      <Button size="lg" disabled={busy} onClick={() => submit(null, null)}>
        {busy ? "רגע…" : "סיימנו את המשימה ✅"}
      </Button>
    </div>
  );
}
