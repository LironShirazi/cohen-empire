"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { StoryAvatar, StoryRing } from "@/components/stories/story-avatar";
import { StoryComposer } from "@/components/stories/story-composer";
import { StoryViewer } from "@/components/stories/story-viewer";
import { purgeMyExpiredStories } from "@/lib/story-actions";
import { shortName, type StoryFeed, type StoryGroup, type StoryItem } from "@/lib/stories";

/**
 * פס הסטוריז בראש ההיירו (6a) — כמו באינסטגרם, מעל הלוגו.
 *
 * העיגול הראשון תמיד שלי: "+" צהוב כשאין לי סטורי, טבעת כשיש. אחריו
 * מי שיש לו משהו שלא ראיתי, ובסוף מה שכבר נצפה (הסדר מגיע מהשרת).
 *
 * "נצפה" מתעדכן כאן מקומית מיד עם הצפייה, ולא רק ברענון — אחרת
 * הטבעת הייתה נשארת צבעונית אחרי שסוגרים את הסטורי.
 *
 * ⚠️ מאותה סיבה גם הסטורי שלי מתעדכן מקומית: מה שפרסמתי נוסף לעיגול
 * מיד (השורה שחזרה מה-insert), ומה שמחקתי יורד מיד. `router.refresh()`
 * עדיין רץ ברקע ומיישר קו, אבל בנייד הוא לא תמיד הגיע — והסטורי החדש
 * הופיע רק אחרי רענון ידני של העמוד.
 */
export function StoriesBar({ feed }: { feed: StoryFeed }) {
  const router = useRouter();
  const [seenIds, setSeenIds] = useState<Set<string>>(() => new Set());
  const [viewing, setViewing] = useState<{ groups: StoryGroup[]; start: number } | null>(null);
  const [composing, setComposing] = useState(false);
  const [posted, setPosted] = useState<StoryItem[]>([]);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    void purgeMyExpiredStories();
  }, []);

  const others = useMemo(
    () =>
      feed.others.map((g) => ({
        ...g,
        seen: g.seen || g.items.every((it) => seenIds.has(it.id)),
      })),
    [feed.others, seenIds]
  );
  // מה שנצפה עכשיו זז לסוף רק ברענון הבא — קפיצה באמצע הפס בזמן
  // שהאצבע עליו מבלבלת יותר משהיא עוזרת

  const onSeen = useCallback((id: string) => {
    setSeenIds((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  }, []);

  const closeViewer = useCallback(() => {
    setViewing(null);
    router.refresh();
  }, [router]);

  const mine = useMemo<StoryGroup | null>(() => {
    const fromServer = feed.mine?.items ?? [];
    const known = new Set(fromServer.map((it) => it.id));
    const items = [...fromServer, ...posted.filter((it) => !known.has(it.id))].filter(
      (it) => !deletedIds.has(it.id)
    );
    if (!items.length) return null;
    return (
      feed.mine
        ? { ...feed.mine, items }
        : { ...feed.me, items, seen: true, viewers: {} }
    );
  }, [feed.mine, feed.me, posted, deletedIds]);

  const onDeleted = useCallback(
    (id: string) => {
      setDeletedIds((prev) => new Set(prev).add(id));
      closeViewer();
    },
    [closeViewer]
  );

  return (
    <>
      <div className="-mx-5 -mt-8 mb-4 flex gap-2.5 overflow-x-auto border-b border-white/10 px-3.5 pt-1.5 pb-3.5 [scrollbar-width:none] md:-mt-14">
        <button
          type="button"
          onClick={() =>
            mine ? setViewing({ groups: [mine], start: 0 }) : setComposing(true)
          }
          aria-label={mine ? "הסטורי שלך" : "הוספת סטורי"}
          className="flex w-[68px] flex-none cursor-pointer flex-col items-center gap-1.5"
        >
          <span className="relative block">
            <StoryRing state={mine ? "new" : "none"}>
              <StoryAvatar name={feed.me.name} url={feed.me.avatar_url} />
            </StoryRing>
            {!mine ? (
              <span
                aria-hidden
                className="absolute bottom-0 left-0 flex size-[23px] items-center justify-center rounded-full border-[2.5px] border-navy bg-yellow text-base leading-none font-black text-ink"
              >
                +
              </span>
            ) : null}
          </span>
          <span className="text-[11.5px] whitespace-nowrap text-on-navy-muted">
            {mine ? "הסטורי שלך" : "הוספה"}
          </span>
        </button>

        {others.map((group, index) => (
          <button
            key={group.user_id}
            type="button"
            onClick={() => setViewing({ groups: others, start: index })}
            aria-label={`הסטורי של ${group.name}${group.seen ? " (נצפה)" : " (חדש)"}`}
            className="flex w-[68px] flex-none cursor-pointer flex-col items-center gap-1.5"
          >
            <StoryRing state={group.seen ? "seen" : "new"}>
              <StoryAvatar name={group.name} url={group.avatar_url} />
            </StoryRing>
            <span
              className={`max-w-[68px] truncate text-[11.5px] ${
                group.seen ? "font-normal text-on-navy-muted/70" : "font-bold text-white"
              }`}
            >
              {shortName(group.name)}
            </span>
          </button>
        ))}
      </div>

      {viewing ? (
        <StoryViewer
          groups={viewing.groups}
          start={viewing.start}
          myUserId={feed.me.user_id}
          onClose={closeViewer}
          onSeen={onSeen}
          onAddMore={() => {
            setViewing(null);
            setComposing(true);
          }}
          onDeleted={onDeleted}
        />
      ) : null}

      <StoryComposer
        open={composing}
        userId={feed.me.user_id}
        onClose={() => setComposing(false)}
        onPosted={(item) => {
          setPosted((prev) => [...prev, item]);
          setComposing(false);
          router.refresh();
        }}
      />
    </>
  );
}
