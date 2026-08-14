"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { attachmentKind } from "@/lib/media";
import {
  applyMention,
  findMentionQuery,
  matchMentionables,
  mentionedIdsIn,
  splitMentions,
  type Mentionable,
  type MentionQuery,
} from "@/lib/mentions";
import { useActiveChat } from "@/components/notifications/notification-center";
import { createClient } from "@/lib/supabase/client";
import type { ChatMessage, Profile } from "@/lib/supabase/types";

const MAX_FILE_MB = 50;
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;
const POLL_MS = 20000;

type SenderProfile = Pick<Profile, "id" | "full_name" | "avatar_url">;
type PendingFile = { url: string; type: string; name: string };

const messageSelect = "*, sender:profiles(id, full_name, avatar_url)";

/**
 * Realtime מוסר את השורה כפי שהיא ב-WAL, ולכן `created_at` עלול להגיע
 * בפורמט הטקסט של Postgres (`2026-08-11 20:00:00.12+00`) ולא כ-ISO
 * כמו מ-PostgREST. בלי יישור לפורמט אחד המיון לפי הזמן מתבלבל בין שני
 * המקורות, ו-`new Date()` מחזיר Invalid Date בחלק מהדפדפנים.
 */
function toIsoTimestamp(value: string): string {
  const match =
    /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2}(?:\.\d+)?)(Z|[+-]\d{2}(?::?\d{2})?)?$/.exec(
      value
    );
  if (!match) return value;
  const [, date, time, zone = "+00"] = match;
  const offset =
    zone === "Z"
      ? "+00:00"
      : zone.length === 3
        ? `${zone}:00`
        : zone.length === 5
          ? `${zone.slice(0, 3)}:${zone.slice(3)}`
          : zone;
  return `${date}T${time}${offset}`;
}

/**
 * הצ'אט הקבוצתי (docs/01 §5, docs/02 §3.7) — מקביל ל-
 * design-system/components/chat.html.
 *
 * אותה קומפוננטה משרתת את המשתתף ואת המנהל התורן: ההבדל היחיד הוא
 * איזו קבוצה מקבלים ב-props. ההרשאה עצמה נאכפת ב-RLS, לא כאן.
 */
export function ChatRoom({
  teamId,
  teamColor,
  currentUserId,
  adminIds,
  mentionables,
  unreadMessageIds,
  initialMessages,
  canPost,
  lockedReason,
}: {
  teamId: string;
  teamColor: string;
  currentUserId: string;
  adminIds: string[];
  /** מי מופיע בבורר ה-@ (docs/04 §3) */
  mentionables: Mentionable[];
  /** הודעות שיש עליהן התראה שלא נקראה — נקודת הגלילה בפתיחה */
  unreadMessageIds: string[];
  initialMessages: ChatMessage[];
  canPost: boolean;
  lockedReason?: string;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<PendingFile | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mention, setMention] = useState<MentionQuery | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);

  // כל עוד הצ'אט הזה פתוח, הבאנר לא יקפוץ על הודעות ממנו
  useActiveChat(teamId);

  const composer = useRef<HTMLInputElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  // האם הרשימה גלולה לתחתית — נקבע מתוך הגלילה עצמה, לפני שההודעה
  // החדשה מוסיפה גובה
  const atBottom = useRef(true);
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  // מה שכבר על המסך — כדי שהודעה שנשלחה מכאן לא תופיע פעמיים כשה-
  // Realtime מחזיר אותה בחזרה
  const seen = useRef(new Set(initialMessages.map((message) => message.id)));
  // הרענון התקופתי נוצר פעם אחת, אז הוא קורא את ההודעה האחרונה דרך ref
  // ולא דרך ה-state שנתפס ב-closure
  const messagesRef = useRef(messages);
  const profiles = useRef(
    new Map<string, SenderProfile>(
      initialMessages
        .filter((message) => message.sender)
        .map((message) => [message.sender_id, message.sender as SenderProfile])
    )
  );

  /**
   * מי שקורא את הצ'אט קרא את מה שחיכה לו — גם אזכור וגם הודעת רוחב.
   * מסמנים את **כל** מה שלא נקרא בקבוצה הזו, כי הצ'אט נפתח על ההתראה
   * הראשונה ומשם גוללים; בפועל הכל עבר מול העיניים. ה-RLS מגביל
   * ממילא להתראות שלי.
   */
  const markNotificationsRead = useCallback(async () => {
    const supabase = createClient();
    const { count } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() }, { count: "exact" })
      .eq("team_id", teamId)
      .is("read_at", null);
    // הבאדג' מרונדר בשרת — בלי רענון הוא היה נשאר דלוק עד ניווט מלא
    if (count) router.refresh();
  }, [teamId, router]);

  const append = useCallback(
    (incoming: ChatMessage[]) => {
      const fresh = incoming.filter((message) => !seen.current.has(message.id));
      if (fresh.length === 0) return;
      for (const message of fresh) {
        seen.current.add(message.id);
        if (message.sender) {
          profiles.current.set(message.sender_id, message.sender);
        }
      }
      // התראה שנוצרה בזמן שהצ'אט פתוח נקראת ברגע שההודעה מוצגת.
      // רק שני אלה מייצרים התראה: אזכור שלי, והודעה מהמנהל התורן
      // (שעשויה להיות הודעת רוחב — מכאן אי אפשר לדעת, וזול לנסות)
      if (
        fresh.some(
          (message) =>
            message.mentioned_user_ids.includes(currentUserId) ||
            adminIds.includes(message.sender_id)
        )
      ) {
        void markNotificationsRead();
      }
      setMessages((current) =>
        [...current, ...fresh].sort((a, b) =>
          a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0
        )
      );
    },
    [currentUserId, adminIds, markNotificationsRead]
  );

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`team-chat-${teamId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `team_id=eq.${teamId}`,
        },
        async (payload) => {
          const row = payload.new as ChatMessage;
          if (seen.current.has(row.id)) return;

          // ה-payload של Realtime הוא השורה בלבד, בלי הפרופיל המצורף.
          // ברוב המקרים השולח כבר מוכר מהודעות קודמות; רק אם לא —
          // שואלים את השרת פעם אחת ושומרים במטמון.
          let sender = profiles.current.get(row.sender_id) ?? null;
          if (!sender) {
            const { data } = await supabase
              .from("profiles")
              .select("id, full_name, avatar_url")
              .eq("id", row.sender_id)
              .maybeSingle();
            sender = (data as SenderProfile | null) ?? null;
          }
          append([
            { ...row, created_at: toIsoTimestamp(row.created_at), sender },
          ]);
        }
      )
      .subscribe();

    // רשת ביטחון לקליטה חלשה בשטח — אותו שיקול כמו ב-WaitingWatcher:
    // ה-WebSocket עלול ליפול בלי להתאושש, והצ'אט הוא איך שהקבוצה
    // מתאמת באמצע מירוץ
    const poll = setInterval(async () => {
      const since = messagesRef.current.at(-1)?.created_at;
      // בלי נקודת התחלה (מסך שנפתח ריק) מבקשים את ה-50 האחרונות ולא את
      // ה-50 הראשונות — אחרת קבוצה ותיקה תמשוך את ההיסטוריה מלמטה למעלה
      const query = supabase
        .from("messages")
        .select(messageSelect)
        .eq("team_id", teamId)
        .order("created_at", { ascending: !!since })
        .limit(50);

      const { data } = await (since ? query.gt("created_at", since) : query);
      if (data) append(data as unknown as ChatMessage[]);
    }, POLL_MS);

    return () => {
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [teamId, append]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // גוללים להודעה החדשה רק אם המשתמש כבר בתחתית הרשימה — אחרת כל הודעה
  // שנכנסת באמצע קריאה של ההיסטוריה הייתה קופצת לו מתחת לאצבע
  useEffect(() => {
    const node = scroller.current;
    if (node && atBottom.current) node.scrollTop = node.scrollHeight;
  }, [messages]);

  /**
   * "מה פספסתי" (docs/02 §3.8, docs/04 §3): פתיחת הצ'אט קופצת לאזכור
   * ולא לתחתית — או להודעה מהעוגן `#m-<id>` כשהגיעו מהבאנר.
   *
   * רץ **אחרי** האפקט שגולל לתחתית (סדר ההצהרה), ומכבה את
   * `atBottom` כדי שהודעה חדשה שתיכנס לא תמשוך את המסך למטה בזמן
   * שקוראים את מה שפספסנו.
   */
  const didJump = useRef(false);
  useEffect(() => {
    if (didJump.current) return;
    didJump.current = true;

    const hash = window.location.hash;
    const target = hash.startsWith("#m-")
      ? hash.slice("#m-".length)
      : unreadMessageIds[0];
    if (!target) return;

    const node = document.getElementById(`m-${target}`);
    if (!node) return;

    atBottom.current = false;
    node.scrollIntoView({ block: "center" });
    node.classList.add("mention-flash");
  }, [unreadMessageIds]);

  // מי שפתח את הצ'אט קרא את מה שחיכה לו
  useEffect(() => {
    if (unreadMessageIds.length > 0) void markNotificationsRead();
    // כוונה: פעם אחת בפתיחה. עדכון שוטף נעשה מתוך append
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function upload(file: File) {
    setError(null);
    if (file.size > MAX_FILE_BYTES) {
      setError(
        `הקובץ גדול מדי (${Math.round(file.size / 1024 / 1024)}MB). ` +
          `המקסימום הוא ${MAX_FILE_MB}MB.`
      );
      return;
    }

    setBusy(true);
    try {
      const supabase = createClient();
      const extension = file.name.split(".").pop()?.toLowerCase() ?? "bin";
      // התיקייה היא מזהה הקבוצה — מדיניות ה-Storage מוודאת שרק מי
      // שרשאי לכתוב בצ'אט הזה יכול להעלות לתוכה
      const path = `${teamId}/${crypto.randomUUID()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("chat-files")
        .upload(path, file, { upsert: false });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("chat-files").getPublicUrl(path);
      setPending({
        url: data.publicUrl,
        type: file.type || "application/octet-stream",
        name: file.name,
      });
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "ההעלאה נכשלה — ננסה שוב?"
      );
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    const body = draft.trim();
    if ((!body && !pending) || busy) return;

    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data, error: insertError } = await supabase
        .from("messages")
        .insert({
          team_id: teamId,
          sender_id: currentUserId,
          body: body || null,
          attachment_url: pending?.url ?? null,
          attachment_type: pending?.type ?? null,
          // נגזר מהטקסט הסופי, לא ממה שנבחר בבורר: אם מחקו את שם
          // האזכור אחרי הבחירה, אסור שתישלח התראה על משהו שלא כתוב
          mentioned_user_ids: mentionedIdsIn(body, mentionables),
        })
        .select(messageSelect)
        .single();
      if (insertError) throw insertError;

      // מי ששלח רוצה תמיד לראות את ההודעה שלו, גם אם קרא היסטוריה
      atBottom.current = true;
      append([data as unknown as ChatMessage]);
      setDraft("");
      setMention(null);
      setPending(null);
    } catch (sendError) {
      setError(
        sendError instanceof Error
          ? sendError.message
          : "ההודעה לא נשלחה — ננסה שוב?"
      );
    } finally {
      setBusy(false);
    }
  }

  // אי אפשר לאזכר את עצמך — הטריגר בשרת מדלג על השולח ממילא
  const candidates = mention
    ? matchMentionables(
        mentionables.filter((person) => person.id !== currentUserId),
        mention.query
      ).slice(0, 6)
    : [];
  const activeCandidate = Math.min(mentionIndex, candidates.length - 1);

  /** מיקום הסמן קובע אם אנחנו בתוך אזכור — גם אחרי לחיצה באמצע הטקסט */
  function syncMention(value: string, caret: number | null) {
    setMention(findMentionQuery(value, caret ?? value.length));
    setMentionIndex(0);
  }

  function pick(person: Mentionable) {
    if (!mention) return;
    const node = composer.current;
    const caret = node?.selectionStart ?? draft.length;
    const next = applyMention(draft, mention, person, caret);

    setDraft(next.text);
    setMention(null);
    // הסמן חוזר לאחרי הטוקן רק אחרי שהערך החדש נצבע במסך
    requestAnimationFrame(() => {
      node?.focus();
      node?.setSelectionRange(next.caret, next.caret);
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div
        ref={scroller}
        onScroll={(event) => {
          const node = event.currentTarget;
          atBottom.current =
            node.scrollHeight - node.scrollTop - node.clientHeight < 120;
        }}
        className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto rounded-card border border-line bg-bg-2 p-3"
      >
        {messages.length === 0 ? (
          <p className="m-auto text-center text-sm text-muted">
            עוד אין הודעות. מי פותח? 💬
          </p>
        ) : null}

        {messages.map((message) => (
          <Bubble
            key={message.id}
            message={message}
            teamColor={teamColor}
            mine={message.sender_id === currentUserId}
            fromAdmin={adminIds.includes(message.sender_id)}
            mentionsMe={message.mentioned_user_ids.includes(currentUserId)}
            mentionables={mentionables}
          />
        ))}
      </div>

      {error ? (
        <p className="rounded-card-sm bg-brand-soft px-3.5 py-2.5 text-sm font-bold text-brand">
          {error}
        </p>
      ) : null}

      {!canPost ? (
        <p className="rounded-card-sm bg-bg-2 px-3.5 py-2.5 text-center text-sm text-muted">
          {lockedReason ?? "הצ'אט סגור לכתיבה."}
        </p>
      ) : (
        <>
          {pending ? (
            <div className="flex items-center gap-2 rounded-card-sm border border-line bg-surface px-3 py-2 text-sm">
              <span>📎</span>
              <span className="min-w-0 flex-1 truncate font-bold">
                {pending.name}
              </span>
              <button
                type="button"
                onClick={() => setPending(null)}
                className="font-bold text-muted hover:text-brand"
              >
                הסרה
              </button>
            </div>
          ) : null}

          <input
            ref={fileInput}
            type="file"
            hidden
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (file) await upload(file);
              event.target.value = "";
            }}
          />
          <input
            ref={cameraInput}
            type="file"
            accept="image/*,video/*"
            capture="environment"
            hidden
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (file) await upload(file);
              event.target.value = "";
            }}
          />

          {/* בורר האזכורים — נפתח מעל המחבר, כלומר מעל המקלדת בנייד
              (docs/04 §3). נסגר מעצמו כשאין התאמות, כי שם בעברית
              מכיל רווח ואי אפשר לעצור את החיפוש ברווח הראשון */}
          {candidates.length > 0 ? (
            <div className="max-h-56 overflow-y-auto rounded-card border border-line bg-surface shadow-card">
              {candidates.map((person, index) => (
                <button
                  key={person.id}
                  type="button"
                  // onMouseDown ולא onClick: click מגיע אחרי blur של
                  // השדה, ואז הסמן שממנו נגזר מיקום ההחלפה כבר אבד
                  onMouseDown={(event) => {
                    event.preventDefault();
                    pick(person);
                  }}
                  onMouseEnter={() => setMentionIndex(index)}
                  className={`flex w-full items-center gap-2.5 px-3.5 py-2.5 text-right ${
                    index === activeCandidate ? "bg-bg-2" : ""
                  }`}
                >
                  <span
                    className="flex size-8 flex-none items-center justify-center rounded-full text-sm font-extrabold text-white"
                    style={{
                      background: person.is_admin ? "var(--gold)" : teamColor,
                    }}
                  >
                    {person.full_name.slice(0, 1)}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-bold">
                    {person.full_name}
                  </span>
                  {person.is_admin ? (
                    <span className="text-sm text-muted">👑 מנהל תורן</span>
                  ) : null}
                </button>
              ))}
            </div>
          ) : null}

          {/* composer — design-system/components/chat.html */}
          <div className="flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-2">
            <button
              type="button"
              aria-label="צירוף קובץ"
              disabled={busy}
              onClick={() => fileInput.current?.click()}
              className="text-xl disabled:opacity-50"
            >
              📎
            </button>
            <button
              type="button"
              aria-label="צילום"
              disabled={busy}
              onClick={() => cameraInput.current?.click()}
              className="text-xl disabled:opacity-50"
            >
              📷
            </button>
            <input
              ref={composer}
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
                syncMention(event.target.value, event.target.selectionStart);
              }}
              onSelect={(event) => {
                const node = event.currentTarget;
                syncMention(node.value, node.selectionStart);
              }}
              onKeyDown={(event) => {
                if (candidates.length > 0) {
                  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                    event.preventDefault();
                    const step = event.key === "ArrowDown" ? 1 : -1;
                    setMentionIndex(
                      (current) =>
                        (Math.min(current, candidates.length - 1) +
                          step +
                          candidates.length) %
                        candidates.length
                    );
                    return;
                  }
                  if (event.key === "Enter" || event.key === "Tab") {
                    event.preventDefault();
                    pick(candidates[activeCandidate]);
                    return;
                  }
                  if (event.key === "Escape") {
                    event.preventDefault();
                    setMention(null);
                    return;
                  }
                }
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void send();
                }
              }}
              placeholder="הודעה…  (@ לתיוג)"
              className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted"
            />
            <button
              type="button"
              disabled={busy || (!draft.trim() && !pending)}
              onClick={() => void send()}
              className="font-extrabold text-brand disabled:opacity-40"
            >
              {busy ? "…" : "שלח"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function Bubble({
  message,
  teamColor,
  mine,
  fromAdmin,
  mentionsMe,
  mentionables,
}: {
  message: ChatMessage;
  teamColor: string;
  mine: boolean;
  fromAdmin: boolean;
  mentionsMe: boolean;
  mentionables: Mentionable[];
}) {
  const time = new Date(message.created_at).toLocaleTimeString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const tone = mine
    ? "self-end bg-brand text-white rounded-ss-[4px]"
    : fromAdmin
      ? "self-start bg-yellow-soft border border-yellow rounded-se-[4px]"
      : "self-start bg-surface border border-line rounded-se-[4px]";

  return (
    <div
      // עוגן לקפיצה מהבאנר ומ"מה פספסתי" (docs/02 §3.8)
      id={`m-${message.id}`}
      className={`max-w-[85%] rounded-card px-3.5 py-2.5 text-base ${tone} ${
        mentionsMe ? "ring-2 ring-yellow" : ""
      }`}
    >
      {!mine ? (
        <div
          className="mb-0.5 flex items-center gap-1.5 text-[13px] font-extrabold"
          style={{ color: fromAdmin ? "#9A7B00" : teamColor }}
        >
          {fromAdmin ? (
            <span>📣 המנהל התורן</span>
          ) : (
            <>
              <i
                className="size-2.5 flex-none rounded-full"
                style={{ background: teamColor }}
              />
              {message.sender?.full_name ?? "בן משפחה"}
            </>
          )}
        </div>
      ) : null}

      {message.attachment_url ? (
        <Attachment url={message.attachment_url} type={message.attachment_type} />
      ) : null}

      {message.body ? (
        <p className="whitespace-pre-wrap break-words">
          {splitMentions(
            message.body,
            message.mentioned_user_ids,
            mentionables
          ).map((part, index) =>
            part.mentioned ? (
              <b
                key={index}
                className="font-extrabold"
                // בבועה שלי הרקע כבר אדום — צבע הקבוצה עליו לא נקרא
                style={mine ? undefined : { color: teamColor }}
              >
                {part.text}
              </b>
            ) : (
              part.text
            )
          )}
        </p>
      ) : null}

      <span
        className={`mt-1 block text-left text-[11px] ${mine ? "text-white/70" : "text-muted"}`}
      >
        {time}
      </span>
    </div>
  );
}

function Attachment({ url, type }: { url: string; type: string | null }) {
  const kind = attachmentKind(type, url);

  if (kind === "image") {
    return (
      <a href={url} target="_blank" rel="noreferrer">
        {/* next/image לא מכיר את דומיין ה-Storage, והקבצים כאן מגיעים
            מהמשתתפים עצמם */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt="תמונה שצורפה להודעה"
          loading="lazy"
          className="mb-1.5 max-h-64 w-full rounded-card-sm object-contain"
        />
      </a>
    );
  }

  if (kind === "video") {
    return (
      <video
        src={url}
        controls
        playsInline
        preload="metadata"
        className="mb-1.5 max-h-64 w-full rounded-card-sm"
      />
    );
  }

  if (kind === "audio") {
    return <audio src={url} controls className="mb-1.5 w-full" />;
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="mb-1.5 block rounded-card-sm bg-black/5 px-3 py-4 text-center text-sm font-bold underline"
    >
      📎 קובץ מצורף
    </a>
  );
}
