"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm";
import { StoryAvatar } from "@/components/stories/story-avatar";
import { deleteStory, markStoryViewed } from "@/lib/story-actions";
import {
  STORY_SECONDS,
  storyBackground,
  timeAgo,
  timeLeft,
  type StoryGroup,
} from "@/lib/stories";

/**
 * צפייה בסטורי (6b) — מסך מלא, מתקדם לבד כל 5 שניות.
 *
 * הקשה בצד שמאל = הבא, בצד ימין = הקודם. ⚠️ **פיזי ובכוונה**, כמו
 * באינסטגרם ובסקיצה: הצד הוא של היד, לא של כיוון הקריאה — והאזור
 * של "הבא" רחב יותר (65%) כי זו הפעולה הנפוצה.
 *
 * הסטורי שלי (6e) נפתח עם גיליון "מי צפה" ובלי התקדמות אוטומטית —
 * מי שפותח את העיגול שלו בא לבדוק מי ראה, לא לצפות.
 */
export function StoryViewer({
  groups,
  start,
  myUserId,
  onClose,
  onSeen,
  onAddMore,
  onDeleted,
}: {
  groups: StoryGroup[];
  start: number;
  myUserId: string;
  onClose: () => void;
  onSeen: (storyId: string) => void;
  onAddMore: () => void;
  onDeleted: () => void;
}) {
  const [gi, setGi] = useState(start);
  const [ii, setIi] = useState(0);
  // מפתח שמתחלף בכל מעבר — מאתחל את האנימציה של פס ההתקדמות
  const [tick, setTick] = useState(0);
  const [paused, setPaused] = useState(false);
  const [ended, setEnded] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const group = groups[gi];
  const item = group?.items[ii];
  const isMine = group?.user_id === myUserId;

  const go = useCallback((g: number, i: number) => {
    setGi(g);
    setIi(i);
    setTick((t) => t + 1);
    setPaused(false);
    setEnded(false);
    setNow(Date.now());
  }, []);

  const next = useCallback(() => {
    if (ended || !group) return;
    if (ii < group.items.length - 1) go(gi, ii + 1);
    else if (gi < groups.length - 1 && !isMine) go(gi + 1, 0);
    else if (isMine) onClose();
    else setEnded(true);
  }, [ended, group, ii, gi, groups.length, isMine, go, onClose]);

  const prev = useCallback(() => {
    if (ii > 0) go(gi, ii - 1);
    else if (gi > 0 && !isMine) go(gi - 1, groups[gi - 1].items.length - 1);
    else go(gi, 0);
  }, [ii, gi, isMine, groups, go]);

  // רישום צפייה — לא על הסטורי של עצמי (המדיניות דוחה את זה ממילא).
  // תלוי במזהה ולא באובייקט: הפס בונה את הקבוצות מחדש בכל סימון "נצפה",
  // ואובייקט חדש היה שולח את אותה צפייה שוב
  const itemId = item?.id;
  useEffect(() => {
    if (!itemId || isMine || ended) return;
    void markStoryViewed(itemId);
    onSeen(itemId);
  }, [itemId, isMine, ended, onSeen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      // מקלדת ב-RTL: חץ שמאלה = קדימה
      if (e.key === "ArrowLeft") next();
      if (e.key === "ArrowRight") prev();
    };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [next, prev, onClose]);

  if (!group || typeof document === "undefined") return null;

  const running = !paused && !isMine && !ended;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`הסטורי של ${group.name}`}
      className="fixed inset-0 z-[60] overflow-hidden bg-black text-white"
    >
      <div className="relative mx-auto h-full w-full max-w-lg">
        {!ended && item ? (
          <>
            {item.kind === "photo" && item.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.url}
                alt={item.caption ?? `תמונה מ${group.name}`}
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              // ⚠️ בסטורי שלי גיליון "מי צפה" מכסה את 60% התחתונים —
              // הטקסט מתמרכז ב-40% העליונים ולא באמצע המסך, אחרת הוא
              // נעלם מאחורי הגיליון ונשאר רק רקע חלק
              <div
                className="absolute inset-0"
                style={{ background: storyBackground(item.color) }}
              >
                <div
                  className={`absolute inset-x-0 top-0 flex items-center justify-center px-8 text-center ${
                    isMine ? "bottom-[60%] pt-16" : "bottom-0"
                  }`}
                >
                  <p
                    className={`font-display leading-snug ${
                      isMine ? "line-clamp-4 text-[26px]" : "text-[34px]"
                    }`}
                  >
                    {item.caption}
                  </p>
                </div>
              </div>
            )}

            <div className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-[170px] bg-gradient-to-b from-black/55 to-transparent" />

            {/* פס התקדמות לכל סטורי של האדם הזה */}
            <div className="absolute inset-x-2.5 top-[max(14px,env(safe-area-inset-top))] z-[3] flex gap-1">
              {group.items.map((it, i) => (
                <div key={it.id} className="h-[3px] flex-1 overflow-hidden rounded-sm bg-white/35">
                  <div
                    key={i === ii ? tick : undefined}
                    className="h-full bg-white"
                    style={
                      i < ii || (i === ii && isMine)
                        ? { width: "100%" }
                        : i === ii
                          ? {
                              width: 0,
                              animation: `story-fill ${STORY_SECONDS}s linear forwards`,
                              animationPlayState: running ? "running" : "paused",
                            }
                          : { width: 0 }
                    }
                    onAnimationEnd={i === ii ? next : undefined}
                  />
                </div>
              ))}
            </div>

            <div className="absolute inset-x-3 top-[max(26px,calc(env(safe-area-inset-top)+12px))] z-[3] flex items-center gap-2.5">
              <StoryAvatar name={group.name} url={group.avatar_url} size={36} border="2px solid #fff" />
              <p className="min-w-0 truncate leading-tight">
                <b className="text-[15px]">{isMine ? "הסטורי שלך" : group.name}</b>{" "}
                <span className="text-[13px] opacity-80">· {timeAgo(item.created_at, now)}</span>
              </p>
              {!isMine ? (
                <button
                  type="button"
                  onClick={() => setPaused((p) => !p)}
                  aria-label={paused ? "המשך" : "השהיה"}
                  className="ms-auto flex size-[38px] items-center justify-center rounded-full bg-white/15"
                >
                  <Icon name={paused ? "play" : "pause"} size={18} />
                </button>
              ) : null}
              <button
                type="button"
                onClick={onClose}
                aria-label="סגירה"
                className={`${isMine ? "ms-auto" : ""} flex size-[38px] items-center justify-center rounded-full bg-white/15`}
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            <button
              type="button"
              onClick={prev}
              aria-label="הסטורי הקודם"
              className="absolute top-[120px] right-0 bottom-[120px] z-[2] w-[35%]"
            />
            <button
              type="button"
              onClick={next}
              aria-label="הסטורי הבא"
              className="absolute top-[120px] bottom-[120px] left-0 z-[2] w-[65%]"
            />

            {item.kind === "photo" && item.caption ? (
              <div className={`absolute inset-x-0 z-[1] text-center ${isMine ? "top-[22%]" : "bottom-[150px]"}`}>
                <span className="inline-block max-w-[84%] rounded-card-sm bg-black/60 px-4.5 py-2 font-display text-[22px]">
                  {item.caption}
                </span>
              </div>
            ) : null}

            {!isMine ? (
              <p className="absolute inset-x-0 bottom-[max(40px,env(safe-area-inset-bottom))] z-[1] text-center text-[13px] text-white/75">
                {group.avatar_source === "tree"
                  ? "התמונה בעיגול — מהעץ המשפחתי"
                  : group.avatar_source === "google"
                    ? "התמונה בעיגול — מחשבון ה-Google"
                    : null}
              </p>
            ) : (
              <ViewersSheet
                group={group}
                itemIndex={ii}
                now={now}
                onAddMore={onAddMore}
                onDeleted={onDeleted}
              />
            )}
          </>
        ) : (
          <div className="cosmic absolute inset-0 flex flex-col items-center justify-center gap-3.5 p-8 text-center">
            <Icon name="check" size={56} className="text-gold-lite" />
            <h2 className="font-display text-h2">ראיתם הכל!</h2>
            <p className="text-on-navy-muted">אין עוד סטוריז חדשים. נתראה מחר.</p>
            <Button variant="accent" onClick={() => go(start, 0)} className="mt-1.5">
              צפייה מההתחלה
            </Button>
            <Button variant="quiet" onClick={onClose} className="text-on-navy-muted">
              סגירה
            </Button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

/** הסטורי שלי — מי צפה (6e). רק המעלה רואה את הרשימה (RLS ב-0024) */
function ViewersSheet({
  group,
  itemIndex,
  now,
  onAddMore,
  onDeleted,
}: {
  group: StoryGroup;
  itemIndex: number;
  now: number;
  onAddMore: () => void;
  onDeleted: () => void;
}) {
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const item = group.items[itemIndex];
  const viewers = group.viewers?.[item.id] ?? [];

  async function remove() {
    const ok = await confirm({
      title: "מחיקת הסטורי",
      message: "הסטורי ייעלם לכל המשפחה עכשיו, לפני שעברו 24 שעות.",
      confirmLabel: "מחיקה",
    });
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      await deleteStory(item);
      onDeleted();
    } catch {
      setBusy(false);
      setError("המחיקה נכשלה — ננסה שוב?");
    }
  }

  return (
    <div className="absolute inset-x-0 bottom-0 z-[4] flex h-[60%] flex-col rounded-t-card-lg bg-surface px-5 pt-3 text-ink">
      <div aria-hidden className="mx-auto mb-3.5 h-[5px] w-11 rounded-full bg-line" />
      <div className="flex items-center gap-2.5">
        <h2 className="flex items-center gap-2 font-display text-h2">
          <Icon name="eye" size={22} />
          {viewers.length === 1 ? "צפה אחד" : `${viewers.length} צפו`}
        </h2>
        <button
          type="button"
          onClick={() => void remove()}
          disabled={busy}
          className="ms-auto inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3.5 py-2 text-sm font-extrabold text-brand disabled:opacity-50"
        >
          <Icon name="trash" size={16} />
          מחיקה
        </button>
      </div>
      <p className="mt-0.5 text-small text-muted">
        רק את/ה רואה את הרשימה · {timeLeft(item.created_at, now)}
      </p>
      {error ? (
        <p role="alert" className="mt-1 text-sm font-bold text-brand">
          {error}
        </p>
      ) : null}

      <div className="mt-1.5 flex-1 overflow-y-auto">
        {viewers.length === 0 ? (
          <p className="py-6 text-center text-muted">עוד אף אחד לא צפה. תכף.</p>
        ) : (
          viewers.map((v) => (
            <div key={v.viewer_id} className="flex items-center gap-3 border-b border-line py-2.5">
              <StoryAvatar name={v.name} url={v.avatar_url} size={40} border="none" />
              <b className="min-w-0 truncate">{v.name}</b>
              <span className="ms-auto flex-none text-small text-muted">{timeAgo(v.viewed_at, now)}</span>
            </div>
          ))
        )}
      </div>

      <div className="pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <Button variant="secondary" className="w-full" onClick={onAddMore}>
          <Icon name="plus" size={20} />
          סטורי נוסף
        </Button>
      </div>
    </div>
  );
}
