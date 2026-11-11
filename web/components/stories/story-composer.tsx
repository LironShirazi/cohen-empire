"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Note } from "@/components/ui/card";
import { Sheet } from "@/components/ui/sheet";
import { postPhotoStory, postTextStory } from "@/lib/story-actions";
import { STORY_CAPTION_MAX, STORY_COLORS, storyBackground, type StoryItem } from "@/lib/stories";

type Draft =
  | { kind: "photo"; file: File; preview: string }
  | { kind: "text" };

/**
 * הוספת סטורי: גיליון הבחירה (6c) ואז תצוגה מקדימה ושיתוף (6d).
 *
 * "צילום עכשיו" ו"מהגלריה" הם שני `<input type=file>` — הראשון עם
 * `capture` שפותח ישר את המצלמה בנייד. "טקסט על צבע" לא שומר קובץ
 * בכלל, רק את המשפט ואת מספר הצבע.
 */
export function StoryComposer({
  open,
  userId,
  onClose,
  onPosted,
}: {
  open: boolean;
  userId: string;
  onClose: () => void;
  onPosted: (item: StoryItem) => void;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<Draft | null>(null);

  // ה-URL של התצוגה המקדימה חי כל עוד הטיוטה חיה
  useEffect(() => {
    if (draft?.kind !== "photo") return;
    return () => URL.revokeObjectURL(draft.preview);
  }, [draft]);

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setDraft({ kind: "photo", file, preview: URL.createObjectURL(file) });
  }

  function close() {
    setDraft(null);
    onClose();
  }

  return (
    <>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={pick} />
      <input ref={galleryRef} type="file" accept="image/*" hidden onChange={pick} />

      <Sheet open={open && !draft} onClose={close} label="הוספת סטורי">
        <h2 className="text-center font-display text-h2">הוספת סטורי</h2>
        <p className="mt-0.5 text-center text-small text-muted">נעלם מעצמו אחרי 24 שעות</p>

        <div className="mt-4.5 grid grid-cols-3 gap-2.5">
          <ChoiceButton
            onClick={() => cameraRef.current?.click()}
            className="bg-brand text-white shadow-[0_5px_0_var(--brand-deep)]"
            icon={<Icon name="camera" size={34} />}
            label="צילום עכשיו"
          />
          <ChoiceButton
            onClick={() => galleryRef.current?.click()}
            className="bg-yellow text-ink shadow-[0_5px_0_var(--yellow-deep)]"
            icon={<Icon name="image" size={34} />}
            label="מהגלריה"
          />
          <ChoiceButton
            onClick={() => setDraft({ kind: "text" })}
            className="bg-navy text-gold-lite shadow-[0_5px_0_var(--navy-deep)]"
            icon={<span className="font-display text-[30px] leading-[34px]">Aa</span>}
            label="טקסט על צבע"
          />
        </div>

        <Note className="mt-4 flex items-center gap-2.5">
          <Icon name="users" size={20} className="flex-none" />
          רק בני המשפחה שמחוברים עם Google יראו את זה.
        </Note>
        <Button variant="quiet" className="mt-2 w-full" onClick={close}>
          ביטול
        </Button>
      </Sheet>

      {open && draft ? (
        <StoryEditor
          draft={draft}
          userId={userId}
          onBack={() => setDraft(null)}
          onPosted={(item) => {
            setDraft(null);
            onPosted(item);
          }}
        />
      ) : null}
    </>
  );
}

function ChoiceButton({
  onClick,
  className,
  icon,
  label,
}: {
  onClick: () => void;
  className: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex cursor-pointer flex-col items-center gap-2 rounded-card px-1.5 py-4.5 text-[15px] font-extrabold active:translate-y-0.5 ${className}`}
    >
      {icon}
      {label}
    </button>
  );
}

/** 6d — תצוגה מקדימה, כיתוב וכפתור שיתוף אחד גדול */
function StoryEditor({
  draft,
  userId,
  onBack,
  onPosted,
}: {
  draft: Draft;
  userId: string;
  onBack: () => void;
  onPosted: (item: StoryItem) => void;
}) {
  const [text, setText] = useState("");
  const [color, setColor] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isText = draft.kind === "text";
  const canShare = !busy && (!isText || text.trim().length > 0);

  async function share() {
    setBusy(true);
    setError(null);
    try {
      const item =
        draft.kind === "photo"
          ? await postPhotoStory(userId, draft.file, text)
          : await postTextStory(userId, text, color);
      onPosted(item);
    } catch {
      setBusy(false);
      setError("השיתוף נכשל — ננסה שוב?");
    }
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="סטורי חדש" className="fixed inset-0 z-[60] overflow-hidden bg-black text-white">
      <div className="relative mx-auto h-full w-full max-w-lg">
        {draft.kind === "photo" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={draft.preview} alt="תצוגה מקדימה של התמונה שנבחרה" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0" style={{ background: storyBackground(color) }} />
        )}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[150px] bg-gradient-to-b from-black/50 to-transparent" />

        <div className="absolute inset-x-3.5 top-[max(16px,env(safe-area-inset-top))] flex items-center gap-2.5">
          <button
            type="button"
            onClick={onBack}
            aria-label="חזרה"
            className="flex size-[42px] items-center justify-center rounded-full bg-black/45"
          >
            <Icon name="close" size={18} />
          </button>
          {isText ? (
            <div role="radiogroup" aria-label="צבע הרקע" className="ms-auto flex gap-2">
              {STORY_COLORS.map((bg, i) => (
                <button
                  key={i}
                  type="button"
                  role="radio"
                  aria-checked={color === i}
                  aria-label={`צבע ${i + 1}`}
                  onClick={() => setColor(i)}
                  className={`size-8 rounded-full border-2 ${color === i ? "border-white ring-2 ring-white/60" : "border-white/40"}`}
                  style={{ background: bg }}
                />
              ))}
            </div>
          ) : null}
        </div>

        {isText ? (
          <div className="absolute inset-x-7 top-[28%]">
            <label htmlFor="st-text" className="sr-only">
              מה רוצים לספר?
            </label>
            <textarea
              id="st-text"
              autoFocus
              maxLength={STORY_CAPTION_MAX}
              rows={3}
              placeholder="מה רוצים לספר?"
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full resize-none bg-transparent text-center font-display text-[32px] leading-snug text-white placeholder:text-white/60 focus:outline-none"
            />
          </div>
        ) : (
          <div className="absolute inset-x-7 bottom-[200px] text-center">
            <label htmlFor="st-cap" className="sr-only">
              כיתוב לסטורי
            </label>
            <input
              id="st-cap"
              maxLength={STORY_CAPTION_MAX}
              placeholder="הוסיפו כיתוב…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full rounded-card-sm bg-black/60 px-3.5 py-2.5 text-center font-display text-[22px] text-white placeholder:text-white/70"
            />
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-b from-transparent to-black/75 px-4.5 pt-15 pb-[max(34px,env(safe-area-inset-bottom))]">
          {error ? (
            <p role="alert" className="mb-2 rounded-card-sm bg-brand px-3 py-2 text-center text-sm font-bold">
              {error}
            </p>
          ) : null}
          <Button variant="accent" size="lg" className="w-full" disabled={!canShare} onClick={() => void share()}>
            {busy ? "משתפים…" : "שיתוף לכל המשפחה"}
          </Button>
          <p className="mt-3 text-center text-[13px] text-white/85">
            ייעלם בעוד 24 שעות
            {draft.kind === "photo" ? " · התמונה מוקטנת לפני השליחה" : null}
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}
