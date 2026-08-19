import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { Mentionable } from "@/lib/mentions";
import type {
  ChatMessage,
  GalleryPhoto,
  JoinRequest,
  LeaderboardRow,
  NotificationType,
  Profile,
  Race,
  RaceStatus,
  Station,
  Team,
  TeamLocation,
  TeamMember,
} from "@/lib/supabase/types";

/** מירוץ כפי שדף הבית רואה אותו — בלי קוד משחק (view ציבורי) */
export type PublicRace = Pick<
  Race,
  "id" | "year" | "name" | "starts_at" | "status"
>;

export async function getUser() {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
}

export async function getProfile(): Promise<Profile | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", auth.user.id)
    .maybeSingle();
  return data as Profile | null;
}

/**
 * המירוץ שדף הבית מציג: קודם אחד שכבר רץ או פתוח להצטרפות,
 * אחרת הקרוב ביותר שעוד לא היה.
 */
export async function getFeaturedRace(): Promise<PublicRace | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();

  const { data: liveOrOpen } = await supabase
    .from("public_races")
    .select("id, year, name, starts_at, status")
    .in("status", ["live", "open"])
    .order("starts_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (liveOrOpen) return liveOrOpen as PublicRace;

  const { data: upcoming } = await supabase
    .from("public_races")
    .select("id, year, name, starts_at, status")
    .gt("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (upcoming) return upcoming as PublicRace;

  const { data: latest } = await supabase
    .from("public_races")
    .select("id, year, name, starts_at, status")
    .order("year", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (latest as PublicRace) ?? null;
}

/** המירוץ הפעיל שאפשר להצטרף אליו או לשחק בו */
export async function getActiveRace(): Promise<Race | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("races")
    .select("*")
    .in("status", ["live", "open"])
    .order("starts_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data as Race | null;
}

export type Membership = { team: Team; race: Race };

/** הקבוצה שאני חבר מאושר בה במירוץ הפעיל */
export async function getMyMembership(): Promise<Membership | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  // שתי שאילתות במקום סינון על משאב מקונן — צורת הסינון של PostgREST
  // על embed מקונן שברירית, וכאן מדובר בכמה שורות בודדות ממילא.
  const { data: memberships } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("user_id", auth.user.id);

  const teamIds = (memberships ?? []).map((row) => row.team_id as string);
  if (teamIds.length === 0) return null;

  const { data } = await supabase
    .from("teams")
    .select("*, race:races(*)")
    .in("id", teamIds);

  const rows = (data ?? []) as unknown as (Team & { race: Race })[];

  // מסורת של 20+ שנה — לאותו אדם יהיו קבוצות בכמה מירוצים. תמיד
  // מחזירים את זה שרלוונטי עכשיו: קודם מירוץ שרץ, אחר כך אחד שפתוח
  // להצטרפות, ורק אז האחרון שהסתיים.
  const rank: Record<string, number> = { live: 0, open: 1, finished: 2 };
  const playable = rows
    .filter((row) => row.race && row.race.status in rank)
    .sort(
      (a, b) =>
        rank[a.race.status] - rank[b.race.status] || b.race.year - a.race.year
    )[0];

  if (!playable) return null;

  const { race, ...team } = playable;
  return { team: team as Team, race };
}

export async function getMyJoinRequest(): Promise<
  (JoinRequest & { team: Team; race: Race }) | null
> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const { data } = await supabase
    .from("join_requests")
    .select("*, team:teams(*), race:races(*)")
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data as (JoinRequest & { team: Team; race: Race }) | null;
}

/** המירוצים שאני מנהל תורן שלהם */
export async function getMyAdminRaces(): Promise<Race[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];

  const { data } = await supabase
    .from("race_admins")
    .select("race:races(*)")
    .eq("user_id", auth.user.id);

  return ((data ?? []) as unknown as { race: Race }[])
    .map((row) => row.race)
    .filter(Boolean)
    .sort((a, b) => b.year - a.year);
}

/** המנהלים התורנים של המירוץ + כל הפרופילים, לבורר המינוי */
export async function getRaceAdminProfiles(raceId: string): Promise<Profile[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("race_admins")
    .select("profile:profiles(*)")
    .eq("race_id", raceId);

  return ((data ?? []) as unknown as { profile: Profile }[])
    .map((row) => row.profile)
    .filter(Boolean);
}

export async function getAllProfiles(): Promise<Profile[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .order("full_name");
  return (data ?? []) as Profile[];
}

export async function isRaceAdmin(raceId: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return false;
  const { data } = await supabase
    .from("race_admins")
    .select("race_id")
    .eq("race_id", raceId)
    .eq("user_id", auth.user.id)
    .maybeSingle();
  return Boolean(data);
}

export type TeamWithMembers = Team & { members: TeamMember[] };

export async function getRaceTeams(raceId: string): Promise<TeamWithMembers[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("teams")
    .select("*, members:team_members(*)")
    .eq("race_id", raceId)
    .order("join_code");
  return (data ?? []) as TeamWithMembers[];
}

export async function getLeaderboard(raceId: string): Promise<LeaderboardRow[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_leaderboard", { p_race_id: raceId });
  return (data ?? []) as LeaderboardRow[];
}

export async function getRace(raceId: string): Promise<Race | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("races")
    .select("*")
    .eq("id", raceId)
    .maybeSingle();
  return data as Race | null;
}

export async function getRaceStations(raceId: string): Promise<Station[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("stations")
    .select("*")
    .eq("race_id", raceId)
    .order("created_at");
  return (data ?? []) as Station[];
}

export type TeamOrder = {
  team: Team;
  stations: { id: string; name: string; position: number }[];
};

/** סדר התחנות של כל קבוצה — לתצוגה ולעריכה ידנית במסך הניהול */
export async function getTeamStationOrders(raceId: string): Promise<TeamOrder[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const teams = await getRaceTeams(raceId);
  if (teams.length === 0) return [];

  const { data } = await supabase
    .from("team_stations")
    .select("team_id, position, station:stations(id, name)")
    .in(
      "team_id",
      teams.map((team) => team.id)
    )
    .order("position");

  const rows = (data ?? []) as unknown as {
    team_id: string;
    position: number;
    station: { id: string; name: string };
  }[];

  return teams.map((team) => ({
    team,
    stations: rows
      .filter((row) => row.team_id === team.id)
      .map((row) => ({
        id: row.station.id,
        name: row.station.name,
        position: row.position,
      })),
  }));
}

export type PendingRequest = JoinRequest & {
  team: Pick<Team, "id" | "name" | "color" | "animal">;
  profile: Pick<Profile, "id" | "full_name" | "avatar_url"> | null;
};

export async function getPendingRequests(
  raceId: string
): Promise<PendingRequest[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("join_requests")
    .select(
      "*, team:teams(id, name, color, animal), profile:profiles(id, full_name, avatar_url)"
    )
    .eq("race_id", raceId)
    .eq("status", "pending")
    .order("created_at");
  return (data ?? []) as unknown as PendingRequest[];
}

/** תור אישורי המשימות של המנהל — קבוצות שסימנו "סיימנו" וממתינות */
export type ApprovalRow = {
  team_id: string;
  station_id: string;
  approval_requested_at: string;
  proof_url: string | null;
  team: Pick<Team, "id" | "name" | "color" | "animal">;
  station: Pick<Station, "id" | "name">;
};

export async function getApprovalQueue(raceId: string): Promise<ApprovalRow[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const teams = await getRaceTeams(raceId);
  const teamIds = teams.map((team) => team.id);
  if (teamIds.length === 0) return [];

  const { data } = await supabase
    .from("team_progress")
    .select(
      "team_id, station_id, approval_requested_at, proof_url, team:teams(id, name, color, animal), station:stations(id, name)"
    )
    .in("team_id", teamIds)
    .is("completed_at", null)
    .not("approval_requested_at", "is", null)
    .order("approval_requested_at");

  return (data ?? []) as unknown as ApprovalRow[];
}

/** באיזו תחנה כל קבוצה נמצאת עכשיו — למנהל מותר לראות הכל */
export type TeamPosition = {
  team: TeamWithMembers;
  station: Pick<Station, "id" | "name"> | null;
  position: number | null;
  arrived: boolean;
};

export async function getTeamPositions(raceId: string): Promise<TeamPosition[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const teams = await getRaceTeams(raceId);
  if (teams.length === 0) return [];

  const { data: order } = await supabase
    .from("team_stations")
    .select("team_id, station_id, position, station:stations(id, name)")
    .in(
      "team_id",
      teams.map((team) => team.id)
    )
    .order("position");

  const { data: progress } = await supabase
    .from("team_progress")
    .select("team_id, station_id, arrived_at, completed_at")
    .in(
      "team_id",
      teams.map((team) => team.id)
    );

  type OrderRow = {
    team_id: string;
    station_id: string;
    position: number;
    station: Pick<Station, "id" | "name">;
  };
  const orderRows = (order ?? []) as unknown as OrderRow[];
  const progressRows = (progress ?? []) as unknown as {
    team_id: string;
    station_id: string;
    arrived_at: string | null;
    completed_at: string | null;
  }[];

  return teams.map((team) => {
    const mine = orderRows.filter((row) => row.team_id === team.id);
    const current = mine.find(
      (row) =>
        !progressRows.some(
          (p) =>
            p.team_id === team.id &&
            p.station_id === row.station_id &&
            p.completed_at
        )
    );
    const arrived = Boolean(
      current &&
        progressRows.find(
          (p) => p.team_id === team.id && p.station_id === current.station_id
        )?.arrived_at
    );

    return {
      team,
      station: current?.station ?? null,
      position: current?.position ?? null,
      arrived,
    };
  });
}

/**
 * הודעות הצ'אט של הקבוצה. ה-RLS (0005) הוא זה שמחליט מי רואה — אם
 * מישהו זר יקרא, הוא פשוט יקבל רשימה ריקה.
 * הטעינה מוגבלת ל-LATEST_MESSAGES האחרונות ומוחזרת בסדר כרונולוגי,
 * כי המסך נפתח בתחתית.
 */
const LATEST_MESSAGES = 200;

export async function getTeamMessages(teamId: string): Promise<ChatMessage[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("messages")
    .select(
      "*, sender:profiles(id, full_name, avatar_url)"
    )
    .eq("team_id", teamId)
    .order("created_at", { ascending: false })
    .limit(LATEST_MESSAGES);

  return ((data ?? []) as unknown as ChatMessage[]).reverse();
}

/** מזהי המנהלים התורנים של המירוץ — הצ'אט מסמן את ההודעות שלהם 📣 */
export async function getRaceAdminIds(raceId: string): Promise<string[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("race_admins")
    .select("user_id")
    .eq("race_id", raceId);
  return ((data ?? []) as { user_id: string }[]).map((row) => row.user_id);
}

/**
 * מי אפשר לאזכר בצ'אט של הקבוצה (docs/01 §5.1, docs/04 §3): חברי
 * הקבוצה **הרשומים** + המנהלים התורנים של המירוץ.
 *
 * משתתף ידני (`user_id is null`) לא מופיע — אין למי לשלוח התראה.
 * זו בדיוק אותה רשימה שהטריגר ב-0006 מוכן ליצור עבורה התראה, כך
 * שהבורר לא יכול להציע אזכור שיישלח לחלל.
 */
export async function getMentionables(
  teamId: string,
  raceId: string
): Promise<Mentionable[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();

  const [members, admins] = await Promise.all([
    supabase
      .from("team_members")
      .select("user_id, profile:profiles(id, full_name, avatar_url)")
      .eq("team_id", teamId)
      .not("user_id", "is", null),
    supabase
      .from("race_admins")
      .select("user_id, profile:profiles(id, full_name, avatar_url)")
      .eq("race_id", raceId),
  ]);

  type Row = {
    profile: Pick<Profile, "id" | "full_name" | "avatar_url"> | null;
  };

  const byId = new Map<string, Mentionable>();

  function add(rows: Row[] | null, isAdmin: boolean) {
    for (const row of rows ?? []) {
      // בלי שם אין מה להכניס להודעה — הטוקן הוא השם עצמו
      if (!row.profile?.full_name) continue;
      const existing = byId.get(row.profile.id);
      if (existing) {
        // מנהל שהוא גם חבר בקבוצה — הכתר מנצח
        existing.is_admin ||= isAdmin;
        continue;
      }
      byId.set(row.profile.id, {
        id: row.profile.id,
        full_name: row.profile.full_name,
        avatar_url: row.profile.avatar_url,
        is_admin: isAdmin,
      });
    }
  }

  add(members.data as unknown as Row[] | null, false);
  add(admins.data as unknown as Row[] | null, true);

  return [...byId.values()].sort((a, b) => {
    if (a.is_admin !== b.is_admin) return a.is_admin ? 1 : -1;
    return a.full_name.localeCompare(b.full_name, "he");
  });
}

/**
 * המיקום האחרון של כל קבוצה, לתצוגה במפה של המנהל (docs/04 §4).
 * ה-RLS (0008) מחזיר שורות רק למנהל התורן של המירוץ — למשתתף
 * תמיד תחזור רשימה ריקה, וזה מכוון.
 */
export type TeamOnMap = {
  team: Pick<Team, "id" | "name" | "color" | "animal">;
  location: TeamLocation;
};

export async function getTeamLocations(raceId: string): Promise<TeamOnMap[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();

  const teams = await getRaceTeams(raceId);
  if (teams.length === 0) return [];

  const { data } = await supabase
    .from("team_locations")
    .select("*")
    .in(
      "team_id",
      teams.map((team) => team.id)
    );

  const byTeam = new Map(teams.map((team) => [team.id, team]));

  return ((data ?? []) as TeamLocation[]).flatMap((location) => {
    const team = byTeam.get(location.team_id);
    return team ? [{ team, location }] : [];
  });
}

/** התראה שטרם נקראה — מזינה את הבאדג' ואת הגלילה לפתיחת הצ'אט */
export type UnreadNotification = {
  id: string;
  type: NotificationType;
  team_id: string;
  message_id: string;
};

/**
 * ההתראות שלי שעדיין לא נקראו — אזכור (@) והודעת רוחב (📣). שתיהן
 * מצביעות על הודעה בצ'אט, ולכן שתיהן נקראות באותה פתיחה.
 *
 * בלי `teamId` — כל המירוצים והקבוצות, מה שהמנהל התורן צריך (הוא
 * מקבל אזכורים מכל צ'אטי המירוץ, docs/01 §5.1).
 */
export async function getUnreadNotifications(
  teamId?: string
): Promise<UnreadNotification[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();

  let query = supabase
    .from("notifications")
    .select("id, type, team_id, message_id")
    .is("read_at", null)
    .not("message_id", "is", null)
    .order("created_at");

  if (teamId) query = query.eq("team_id", teamId);

  const { data } = await query;
  return (data ?? []) as UnreadNotification[];
}

/** תמונה בגלריה + שם מי שהעלה, כפי שהמסך מציג אותה */
export type GalleryPhotoRow = GalleryPhoto & {
  uploader_name: string | null;
};

/** שנה בגלריה: הכותרת שמעליה, והתמונות שבתוכה */
export type GalleryYear = {
  year: number;
  raceName: string | null;
  photos: GalleryPhotoRow[];
};

/**
 * כל הגלריה, מקובצת לשנים — החדשה למעלה (docs/04 §26).
 *
 * הכל בשאילתה אחת ובלי עימוד: זו גלריה משפחתית של פעם בשנה, ואפילו
 * אחרי 20 שנה מדובר בכמה מאות שורות. אם היא תגדל מעבר לזה, הנקודה
 * לעמד בה היא **שנה שלמה** ולא תמונה — ככה נראה גם המסך.
 */
export async function getGallery(): Promise<GalleryYear[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();

  const [{ data: photos }, { data: races }] = await Promise.all([
    supabase
      .from("gallery_photos")
      .select("*, uploader:profiles(full_name)")
      .order("year", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase.from("public_races").select("year, name"),
  ]);

  const raceNames = new Map(
    ((races ?? []) as { year: number; name: string }[]).map((r) => [
      r.year,
      r.name,
    ])
  );

  const years = new Map<number, GalleryYear>();
  for (const row of (photos ?? []) as (GalleryPhoto & {
    uploader: { full_name: string | null } | null;
  })[]) {
    const { uploader, ...photo } = row;
    let bucket = years.get(photo.year);
    if (!bucket) {
      bucket = {
        year: photo.year,
        raceName: raceNames.get(photo.year) ?? null,
        photos: [],
      };
      years.set(photo.year, bucket);
    }
    bucket.photos.push({ ...photo, uploader_name: uploader?.full_name ?? null });
  }

  return [...years.values()];
}

/**
 * השנים שאפשר להעלות אליהן: כל מירוץ שקיים (כדי שהתמונה תקושר אליו),
 * ובנוסף השנים ההיסטוריות — אלה נשמרות בלי `race_id` כי אין להן מירוץ
 * במערכת בכלל.
 */
export async function getGalleryRaceOptions(): Promise<
  { id: string; year: number; name: string }[]
> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("public_races")
    .select("id, year, name")
    .order("year", { ascending: false });
  return (data ?? []) as { id: string; year: number; name: string }[];
}

export const raceStatusLabel: Record<RaceStatus, string> = {
  draft: "טיוטה",
  open: "פתוח להצטרפות",
  live: "רץ עכשיו",
  finished: "הסתיים",
  archived: "בארכיון",
};
