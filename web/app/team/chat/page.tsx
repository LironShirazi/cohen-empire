import Link from "next/link";
import { redirect } from "next/navigation";
import { ChatRoom } from "@/components/chat/chat-room";
import {
  getMentionables,
  getMyMembership,
  getRaceAdminIds,
  getTeamMessages,
  getUnreadNotifications,
  getUser,
} from "@/lib/data";

export default async function TeamChatPage() {
  const user = await getUser();
  if (!user) redirect("/join");

  const membership = await getMyMembership();
  if (!membership) redirect("/join");

  const { team, race } = membership;
  const [messages, adminIds, mentionables, unread] = await Promise.all([
    getTeamMessages(team.id),
    getRaceAdminIds(race.id),
    getMentionables(team.id, race.id),
    getUnreadNotifications(team.id),
  ]);

  return (
    // לא PageShell: מסך הצ'אט הוא היחיד שתופס בדיוק את גובה המסך
    // (h-dvh — בלי שסרגל הכתובת בנייד יחתוך את שורת הכתיבה), כדי
    // שרשימת ההודעות תגלול בתוך עצמה והמחבר יישאר למטה
    <main className="mx-auto flex h-dvh w-full max-w-lg flex-col gap-3 px-4 py-4">
      {/* כותרת מגוונת בצבע הקבוצה (סקיצה 1j) — אותה שפה כמו רצועת
          מסך הקבוצה, כדי שברור שנשארנו באותו מקום */}
      <header
        className="-mx-4 -mt-4 flex flex-none items-center gap-3 border-b border-line px-4 py-3"
        style={{ background: `color-mix(in srgb, ${team.color} 12%, #fff)` }}
      >
        <Link
          href="/team"
          className="text-sm font-bold text-muted hover:text-brand"
        >
          → לקבוצה
        </Link>
        <span
          aria-hidden
          className="flex size-11 flex-none items-center justify-center rounded-2xl border-2 text-2xl"
          style={{
            background: `color-mix(in srgb, ${team.color} 18%, #fff)`,
            borderColor: team.color,
          }}
        >
          {team.animal?.split(" ")[0] ?? "🏁"}
        </span>
        <div className="min-w-0">
          <h1 className="truncate font-display text-h2">{team.name}</h1>
          {/* הסקיצה כותבת "8 חברים + המנהל התורן"; `Team` לא נושא
              רשימת חברים, ו-`mentionables` הוא בדיוק מי שנמצא בצ׳אט
              הזה — חברי הקבוצה יחד עם המנהל התורן */}
          <p className="text-small text-muted">
            {mentionables.length} בצ׳אט הזה
          </p>
        </div>
      </header>

      <ChatRoom
        teamId={team.id}
        teamColor={team.color}
        currentUserId={user.id}
        adminIds={adminIds}
        mentionables={mentionables}
        unreadMessageIds={unread.map((row) => row.message_id)}
        initialMessages={messages}
        canPost={race.status !== "archived"}
        lockedReason="המירוץ בארכיון — אפשר לקרוא את ההיסטוריה, אבל לא לכתוב."
      />
    </main>
  );
}
