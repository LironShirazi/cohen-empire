import Link from "next/link";
import { redirect } from "next/navigation";
import { ChatRoom } from "@/components/chat/chat-room";
import {
  getMyMembership,
  getRaceAdminIds,
  getTeamMessages,
  getUser,
} from "@/lib/data";

export default async function TeamChatPage() {
  const user = await getUser();
  if (!user) redirect("/join");

  const membership = await getMyMembership();
  if (!membership) redirect("/join");

  const { team, race } = membership;
  const [messages, adminIds] = await Promise.all([
    getTeamMessages(team.id),
    getRaceAdminIds(race.id),
  ]);

  return (
    // לא PageShell: מסך הצ'אט הוא היחיד שתופס בדיוק את גובה המסך
    // (h-dvh — בלי שסרגל הכתובת בנייד יחתוך את שורת הכתיבה), כדי
    // שרשימת ההודעות תגלול בתוך עצמה והמחבר יישאר למטה
    <main className="mx-auto flex h-dvh w-full max-w-lg flex-col gap-3 px-4 py-4">
      <header className="flex flex-none items-center gap-3">
        <Link
          href="/team"
          className="text-sm font-bold text-muted hover:text-brand"
        >
          → לקבוצה
        </Link>
        <h1 className="flex items-center gap-2 font-display text-xl">
          <span
            className="size-3 flex-none rounded-full"
            style={{ background: team.color }}
          />
          {team.name}
        </h1>
      </header>

      <ChatRoom
        teamId={team.id}
        teamColor={team.color}
        currentUserId={user.id}
        adminIds={adminIds}
        initialMessages={messages}
        canPost={race.status !== "archived"}
        lockedReason="המירוץ בארכיון — אפשר לקרוא את ההיסטוריה, אבל לא לכתוב."
      />
    </main>
  );
}
