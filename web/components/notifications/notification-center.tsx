"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { Notification, NotificationType } from "@/lib/supabase/types";

/**
 * הבאנר הקופץ של ההתראות (docs/01 §5.1, docs/02 §3.8, docs/04 §3):
 * אזכור (@) והודעת רוחב מהמנהל התורן (📣). שניהם מצביעים על הודעה
 * בצ'אט, ולכן שניהם מוצגים ומנווטים אותו הדבר.
 *
 * למה גלובלי ולא בתוך הצ'אט: במהלך מירוץ אף אחד לא יושב בצ'אט — כולם
 * במסך "מהלך המשחק" או עם הטלפון בכיס. לכן הקומפוננטה עוטפת את כל
 * האפליקציה ב-layout ומציגה מעל כל מסך.
 *
 * זו השכבה ההרגעית משלוש השכבות; הבאדג' על כפתור הצ'אט הוא השכבה
 * המתמידה, והוא נקבע בשרת ולא כאן.
 */

const TOAST_MS = 5000;
/** רשת ביטחון לקליטה חלשה בשטח — אותו שיקול כמו ב-ChatRoom */
const POLL_MS = 25000;

type Toast = {
  notificationId: string;
  kind: NotificationType;
  messageId: string;
  teamId: string;
  senderName: string;
  teamLabel: string;
  teamColor: string;
  preview: string;
  href: string;
};

type ActiveChat = { setActiveChat: (teamId: string | null) => void };

const ActiveChatContext = createContext<ActiveChat | null>(null);

/**
 * הצ'אט הפתוח מדווח על עצמו, כדי שאזכור שמגיע בזמן שהמשתמש קורא את
 * אותו צ'אט לא יקפיץ באנר על הודעה שהוא כבר רואה על המסך.
 */
export function useActiveChat(teamId: string) {
  const context = useContext(ActiveChatContext);
  const setActiveChat = context?.setActiveChat;

  useEffect(() => {
    if (!setActiveChat) return;
    setActiveChat(teamId);
    return () => setActiveChat(null);
  }, [setActiveChat, teamId]);
}

export function NotificationCenter({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [toast, setToast] = useState<Toast | null>(null);

  const activeChat = useRef<string | null>(null);
  // מזהי ההתראות שכבר טופלו — ה-Realtime וה-poll יכולים למסור את אותה
  // שורה פעמיים
  const handled = useRef(new Set<string>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setActiveChat = useCallback((teamId: string | null) => {
    activeChat.current = teamId;
  }, []);
  const context = useMemo(() => ({ setActiveChat }), [setActiveChat]);

  const show = useCallback((next: Toast) => {
    setToast(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), TOAST_MS);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const supabase = createClient();
    let cancelled = false;
    let teardown: (() => void) | null = null;

    /** ההתראה היא רק מצביע — הטקסט לתצוגה נשלף מההודעה עצמה */
    async function toToast(row: Notification): Promise<Toast | null> {
      const known = row.type === "mention" || row.type === "admin_broadcast";
      if (!known || !row.message_id || !row.team_id) return null;

      const { data } = await supabase
        .from("messages")
        .select(
          "id, body, attachment_url, team_id, sender:profiles(full_name), team:teams(id, name, color, animal, race_id)"
        )
        .eq("id", row.message_id)
        .maybeSingle();
      if (!data) return null;

      const message = data as unknown as {
        id: string;
        body: string | null;
        attachment_url: string | null;
        team_id: string;
        sender: { full_name: string | null } | null;
        team: {
          id: string;
          name: string;
          color: string;
          animal: string | null;
          race_id: string;
        } | null;
      };

      // אותה התראה מגיעה גם למשתתף וגם למנהל התורן — לכל אחד יש מסך
      // צ'אט אחר, אז המסלול נגזר מהחברות בקבוצה ולא מהתפקיד הכללי
      const { data: membership } = await supabase
        .from("team_members")
        .select("id")
        .eq("team_id", row.team_id)
        .eq("user_id", row.user_id)
        .maybeSingle();

      const href = membership
        ? `/team/chat#m-${message.id}`
        : `/admin/${message.team?.race_id}/chat/${row.team_id}#m-${message.id}`;

      return {
        notificationId: row.id,
        kind: row.type,
        messageId: message.id,
        teamId: row.team_id,
        senderName: message.sender?.full_name ?? "בן משפחה",
        teamLabel: message.team
          ? `${message.team.name}${message.team.animal ? ` ${message.team.animal.split(" ")[0]}` : ""}`
          : "",
        teamColor: message.team?.color ?? "#e4002b",
        preview: message.body?.trim() || "צירף/ה קובץ 📎",
        href,
      };
    }

    async function handle(row: Notification) {
      if (handled.current.has(row.id)) return;
      handled.current.add(row.id);
      if (row.team_id && activeChat.current === row.team_id) return;

      const next = await toToast(row);
      if (next && !cancelled) show(next);
    }

    async function start() {
      const { data: auth } = await supabase.auth.getUser();
      // הקומפוננטה עוטפת גם את דף הבית הפומבי — בלי משתמש אין למה
      // להאזין, ובטח לא לעשות poll
      if (!auth.user || cancelled) return;

      // התראה שכבר המתינה כשנכנסנו למסך אינה "חדשה": הבאנר הוא
      // השכבה ההרגעית, ומי שלא היה מחובר בזמנה נתפס ע"י הבאדג'
      const { data: existing } = await supabase
        .from("notifications")
        .select("id")
        .is("read_at", null);
      for (const row of (existing ?? []) as { id: string }[]) {
        handled.current.add(row.id);
      }
      if (cancelled) return;

      const channel = supabase
        .channel(`notifications-${auth.user.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${auth.user.id}`,
          },
          (payload) => void handle(payload.new as Notification)
        )
        .subscribe();

      // רשת ביטחון: ה-WebSocket עלול ליפול בשטח בלי להתאושש, וזה
      // ההבדל בין "ראיתי שקראו לי" לבין לפספס את זה עד סוף המירוץ
      const poll = setInterval(async () => {
        const { data } = await supabase
          .from("notifications")
          .select("*")
          .is("read_at", null)
          .order("created_at", { ascending: false })
          .limit(5);

        for (const row of (data ?? []) as Notification[]) {
          await handle(row);
        }
      }, POLL_MS);

      teardown = () => {
        clearInterval(poll);
        supabase.removeChannel(channel);
      };
    }

    void start();

    return () => {
      cancelled = true;
      teardown?.();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [show]);

  async function open() {
    if (!toast) return;
    setToast(null);
    const supabase = createClient();
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", toast.notificationId);
    router.push(toast.href);
    // הבאדג' מגיע מרינדור שרת — בלי רענון הוא היה נשאר דלוק
    router.refresh();
  }

  return (
    <ActiveChatContext.Provider value={context}>
      {children}

      {toast ? (
        <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center p-3">
          <button
            type="button"
            onClick={() => void open()}
            className="notification-toast pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-card bg-navy px-4 py-3 text-right text-white shadow-navy"
          >
            <span
              className="flex size-9 flex-none items-center justify-center rounded-full text-lg font-extrabold text-navy"
              style={{ background: "var(--yellow)" }}
            >
              {toast.kind === "admin_broadcast" ? "📣" : "@"}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-extrabold">
                {toast.kind === "admin_broadcast" ? (
                  "הודעה מהמנהל התורן"
                ) : (
                  <>
                    {toast.senderName}
                    {toast.teamLabel ? (
                      <span className="font-bold text-white/70">
                        {" "}
                        מ{toast.teamLabel}
                      </span>
                    ) : null}{" "}
                    תייג/ה אותך
                  </>
                )}
              </span>
              <span className="block truncate text-sm text-white/80">
                {toast.preview}
              </span>
            </span>
            <span
              className="size-2.5 flex-none rounded-full"
              style={{ background: toast.teamColor }}
            />
          </button>
        </div>
      ) : null}
    </ActiveChatContext.Provider>
  );
}
