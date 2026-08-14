import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChatRoom } from "@/components/chat/chat-room";
import {
  getMentionables,
  getRace,
  getRaceAdminIds,
  getRaceTeams,
  getTeamMessages,
  getUnreadNotifications,
  getUser,
  isRaceAdmin,
} from "@/lib/data";

export default async function AdminTeamChatPage(
  props: PageProps<"/admin/[raceId]/chat/[teamId]">
) {
  const user = await getUser();
  if (!user) redirect("/");

  const { raceId, teamId } = await props.params;
  if (!(await isRaceAdmin(raceId))) notFound();

  const race = await getRace(raceId);
  if (!race) notFound();

  // הקבוצה חייבת להיות של המירוץ הזה — אחרת מנהל של מירוץ אחד היה
  // מגיע לצ'אט של מירוץ אחר דרך שינוי ה-URL
  const team = (await getRaceTeams(raceId)).find((row) => row.id === teamId);
  if (!team) notFound();

  const [messages, adminIds, mentionables, unread] = await Promise.all([
    getTeamMessages(team.id),
    getRaceAdminIds(raceId),
    getMentionables(team.id, raceId),
    getUnreadNotifications(team.id),
  ]);

  return (
    // אותו שיקול גובה כמו במסך הצ'אט של המשתתף
    <main className="mx-auto flex h-dvh w-full max-w-lg flex-col gap-3 px-4 py-4">
      <header className="flex flex-none items-center gap-3">
        <Link
          href={`/admin/${raceId}/chat`}
          className="text-sm font-bold text-muted hover:text-brand"
        >
          → לכל הקבוצות
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
        // מעבר בין הצ'אטים של שתי קבוצות הוא אותו מסך עם param אחר —
        // ה-key מבטיח שהמצב הפנימי (ההודעות שנטענו) לא ידלוף ביניהן
        key={team.id}
        teamId={team.id}
        teamColor={team.color}
        currentUserId={user.id}
        adminIds={adminIds}
        mentionables={mentionables}
        unreadMessageIds={unread.map((row) => row.message_id)}
        initialMessages={messages}
        canPost={race.status !== "archived"}
        lockedReason="המירוץ בארכיון — נעול לכתיבה, פתוח לקריאה."
      />
    </main>
  );
}
