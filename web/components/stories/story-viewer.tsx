"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
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
 *
 * גרירה למטה סוגרת, כמו באינסטגרם: הסטורי נגרר עם האצבע ומתכווץ,
 * והרקע השחור דוהה ומגלה את המסך שמתחת. שחרור אחרי DISMISS_PX או
 * בתנופה מהירה — סגירה; אחרת חוזר למקום. נגיעה ארוכה משהה את ההתקדמות.
 * ⚠️ גרירה שמתחילה בגיליון "מי צפה" לא נתפסת — הרשימה שם נגללת.
 * ⚠️ אחרי גרירה ה-click נבלע ב-capture, אחרת שחרור האצבע מעל אזור
 * "הבא"/"הקודם" היה גם מדפדף.
 */
const DISMISS_PX = 120;
const DISMISS_VELOCITY = 0.6; // px/ms
const DRAG_SLOP = 10;
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
  const [holding, setHolding] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [closing, setClosing] = useState(false);
  // גיליון "מי צפה" בסטורי שלי — מקופל משאיר רק את שורת הכותרת
  const [sheetCollapsed, setSheetCollapsed] = useState(false);
  const drag = useRef<{
    id: number;
    x: number;
    y: number;
    t: number;
    active: boolean;
  } | null>(null);
  const swallowClick = useRef(false);

  const group = groups[gi];
  const item = group?.items[ii];
  const isMine = group?.user_id === myUserId;
  const sheetOpen = isMine && !sheetCollapsed;

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

  const dismiss = useCallback(() => {
    if (closing) return;
    setClosing(true);
    setDragY(window.innerHeight);
    window.setTimeout(onClose, 200);
  }, [closing, onClose]);

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (closing || drag.current) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if ((e.target as Element).closest("[data-no-drag]")) return;
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, t: e.timeStamp, active: false };
    swallowClick.current = false;
    setHolding(true);
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dy = e.clientY - d.y;
    const dx = e.clientX - d.x;
    if (!d.active) {
      // מכריעים רק כשהתנועה בעיקר אנכית ולמטה
      if (Math.abs(dy) < DRAG_SLOP && Math.abs(dx) < DRAG_SLOP) return;
      if (dy <= 0 || Math.abs(dx) > dy) {
        drag.current = null;
        setHolding(false);
        return;
      }
      d.active = true;
      swallowClick.current = true;
      setDragging(true);
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    setDragY(Math.max(0, dy));
  }

  function onPointerEnd(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    setHolding(false);
    if (!d.active) return;
    setDragging(false);
    const dy = Math.max(0, e.clientY - d.y);
    const velocity = dy / Math.max(1, e.timeStamp - d.t);
    if (e.type === "pointerup" && (dy > DISMISS_PX || velocity > DISMISS_VELOCITY)) dismiss();
    else setDragY(0);
  }

  if (!group || typeof document === "undefined") return null;

  const running = !paused && !holding && !dragging && !closing && !isMine && !ended;
  const progress = Math.min(1, dragY / 400);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`הסטורי של ${group.name}`}
      className="fixed inset-0 z-[60] touch-none overflow-hidden text-white select-none"
      style={{
        backgroundColor: `rgba(0,0,0,${closing ? 0 : 1 - progress * 0.7})`,
        transition: dragging ? "none" : "background-color 200ms ease-out",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onClickCapture={(e) => {
        if (!swallowClick.current) return;
        swallowClick.current = false;
        e.stopPropagation();
        e.preventDefault();
      }}
    >
      <div
        className="relative mx-auto h-full w-full max-w-lg overflow-hidden bg-black"
        style={{
          transform: dragY ? `translateY(${dragY}px) scale(${1 - progress * 0.15})` : undefined,
          borderRadius: dragY ? 24 : undefined,
          opacity: closing ? 0 : 1,
          transition: dragging ? "none" : "transform 200ms ease-out, opacity 200ms ease-out, border-radius 200ms ease-out",
        }}
      >
        {!ended && item ? (
          <>
            {item.kind === "photo" && item.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.url}
                draggable={false}
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
                    sheetOpen ? "bottom-[60%] pt-16" : "bottom-0"
                  }`}
                >
                  <p
                    className={`font-display leading-snug ${
                      sheetOpen ? "line-clamp-4 text-[26px]" : "text-[34px]"
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
              <div className={`absolute inset-x-0 z-[1] text-center ${sheetOpen ? "top-[22%]" : "bottom-[150px]"}`}>
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
                collapsed={sheetCollapsed}
                onCollapsedChange={setSheetCollapsed}
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

/** כמה מהגיליון נשאר גלוי כשהוא מקופל: ידית (31px) + שורת הכותרת + אוויר */
const SHEET_PEEK_PX = 96;

/** הסטורי שלי — מי צפה (6e). רק המעלה רואה את הרשימה (RLS ב-0024) */
function ViewersSheet({
  group,
  itemIndex,
  now,
  onAddMore,
  onDeleted,
  collapsed,
  onCollapsedChange,
}: {
  group: StoryGroup;
  itemIndex: number;
  now: number;
  onAddMore: () => void;
  onDeleted: () => void;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
}) {
  const handleStart = useRef<number | null>(null);
  const handleSwiped = useRef(false);
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
    <div
      data-no-drag
      className="absolute inset-x-0 bottom-0 z-[4] flex h-[60%] touch-auto flex-col rounded-t-card-lg bg-surface px-5 text-ink select-text transition-transform duration-200 ease-out"
      style={{
        // מקופל: נשארים גלויים הידית ושורת הכותרת בלבד (PEEK_PX)
        transform: collapsed
          ? `translateY(calc(100% - ${SHEET_PEEK_PX}px - env(safe-area-inset-bottom)))`
          : undefined,
      }}
    >
      {/* הידית: הקשה מקפלת/פותחת, וגם החלקה קצרה למטה/למעלה */}
      <button
        type="button"
        aria-expanded={!collapsed}
        aria-label={collapsed ? "פתיחת רשימת הצופים" : "קיפול רשימת הצופים"}
        onClick={() => {
          // אחרי החלקה הדפדפן שולח גם click — בלי זה הוא מבטל אותה מיד
          if (handleSwiped.current) handleSwiped.current = false;
          else onCollapsedChange(!collapsed);
        }}
        onPointerDown={(e) => {
          handleSwiped.current = false;
          handleStart.current = e.clientY;
        }}
        onPointerUp={(e) => {
          const start = handleStart.current;
          handleStart.current = null;
          if (start === null) return;
          const dy = e.clientY - start;
          if (Math.abs(dy) <= 24) return;
          handleSwiped.current = true;
          onCollapsedChange(dy > 0);
        }}
        className="-mx-5 flex touch-none justify-center pt-3 pb-3.5"
      >
        <span aria-hidden className="h-[5px] w-11 rounded-full bg-line" />
      </button>
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={() => onCollapsedChange(!collapsed)}
          aria-expanded={!collapsed}
          className="flex items-center gap-2 font-display text-h2"
        >
          <Icon name="eye" size={22} />
          {viewers.length === 1 ? "צפה אחד" : `${viewers.length} צפו`}
        </button>
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
