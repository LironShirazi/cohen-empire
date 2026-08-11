"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { attachmentKind } from "@/lib/media";
import { createClient } from "@/lib/supabase/client";
import type { ChatMessage, Profile } from "@/lib/supabase/types";

const MAX_FILE_MB = 50;
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;
const POLL_MS = 20000;

type SenderProfile = Pick<Profile, "id" | "full_name" | "avatar_url">;
type PendingFile = { url: string; type: string; name: string };

const messageSelect = "*, sender:profiles(id, full_name, avatar_url)";

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
  initialMessages,
  canPost,
  lockedReason,
}: {
  teamId: string;
  teamColor: string;
  currentUserId: string;
  adminIds: string[];
  initialMessages: ChatMessage[];
  canPost: boolean;
  lockedReason?: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<PendingFile | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scroller = useRef<HTMLDivElement>(null);
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

  const append = useCallback((incoming: ChatMessage[]) => {
    const fresh = incoming.filter((message) => !seen.current.has(message.id));
    if (fresh.length === 0) return;
    for (const message of fresh) {
      seen.current.add(message.id);
      if (message.sender) profiles.current.set(message.sender_id, message.sender);
    }
    setMessages((current) =>
      [...current, ...fresh].sort((a, b) =>
        a.created_at.localeCompare(b.created_at)
      )
    );
  }, []);

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
          append([{ ...row, sender }]);
        }
      )
      .subscribe();

    // רשת ביטחון לקליטה חלשה בשטח — אותו שיקול כמו ב-WaitingWatcher:
    // ה-WebSocket עלול ליפול בלי להתאושש, והצ'אט הוא איך שהקבוצה
    // מתאמת באמצע מירוץ
    const poll = setInterval(async () => {
      const since = messagesRef.current.at(-1)?.created_at;
      let query = supabase
        .from("messages")
        .select(messageSelect)
        .eq("team_id", teamId)
        .order("created_at")
        .limit(50);
      if (since) query = query.gt("created_at", since);

      const { data } = await query;
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

  useEffect(() => {
    const node = scroller.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages]);

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
        })
        .select(messageSelect)
        .single();
      if (insertError) throw insertError;

      append([data as unknown as ChatMessage]);
      setDraft("");
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

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div
        ref={scroller}
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
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void send();
                }
              }}
              placeholder="הודעה…"
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
}: {
  message: ChatMessage;
  teamColor: string;
  mine: boolean;
  fromAdmin: boolean;
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
    <div className={`max-w-[85%] rounded-card px-3.5 py-2.5 text-base ${tone}`}>
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
        <p className="whitespace-pre-wrap break-words">{message.body}</p>
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
          className="mb-1.5 max-h-64 w-full rounded-card-sm object-cover"
        />
      </a>
    );
  }

  if (kind === "video") {
    return (
      <video
        src={url}
        controls
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
