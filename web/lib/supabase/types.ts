/**
 * טיפוסי ה-DB — נכתבים ידנית מול supabase/migrations.
 * כשמוסיפים טבלה/פונקציה במיגרציה — לעדכן גם כאן.
 */

export type RaceStatus = "draft" | "open" | "live" | "finished" | "archived";
export type JoinRequestStatus = "pending" | "approved" | "rejected";
export type CompletionType =
  | "admin_approve"
  | "secret_code"
  | "photo_upload"
  | "auto";

export type Profile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  birth_year: number | null;
  is_owner: boolean;
  created_at: string;
};

export type Race = {
  id: string;
  year: number;
  name: string;
  starts_at: string | null;
  game_code: string;
  status: RaceStatus;
  start_lat: number | null;
  start_lng: number | null;
  created_at: string;
};

export type Team = {
  id: string;
  race_id: string;
  name: string;
  color: string;
  animal: string | null;
  join_code: string;
  created_at: string;
};

export type TeamMember = {
  id: string;
  team_id: string;
  user_id: string | null;
  display_name: string;
  birth_year: number | null;
  ability: number | null;
  created_at: string;
};

export type JoinRequest = {
  id: string;
  race_id: string;
  team_id: string;
  user_id: string;
  status: JoinRequestStatus;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
};

/**
 * המשימה עצמה (docs/03 — "טקסט + מדיה"). נשמרת כ-jsonb יחיד ולא כשתי
 * עמודות, כדי שהחשיפה המושהית ב-get_team_state תישאר שדה אחד.
 * `media` הוא URL ציבורי מ-bucket `station-media`.
 */
export type TaskContent = {
  text: string;
  media: string | null;
};

export type Station = {
  id: string;
  race_id: string;
  name: string;
  backstory: string | null;
  clue: string | null;
  task_content: TaskContent | null;
  lat: number;
  lng: number;
  radius_m: number;
  completion_type: CompletionType;
  secret_code: string | null;
  created_at: string;
};

export type TeamStation = {
  team_id: string;
  station_id: string;
  position: number;
};

export type TeamProgress = {
  team_id: string;
  station_id: string;
  arrived_at: string | null;
  completed_at: string | null;
  approval_requested_at: string | null;
  approved_by: string | null;
  proof_url: string | null;
};

/**
 * הודעה בצ'אט הקבוצתי (docs/03 — `messages`).
 * `attachment_type` הוא ה-MIME של הקובץ כפי שהדפדפן דיווח עליו, כדי
 * שהתצוגה תדע אם זו תמונה/וידאו/קול בלי לנחש מהסיומת.
 * `mentioned_user_ids` נשמר כאן כבר עכשיו — הטריגר ב-DB הופך אותו
 * להתראות; בורר ה-@ עצמו מגיע בהמשך שלב 2.
 */
export type Message = {
  id: string;
  team_id: string;
  sender_id: string;
  body: string | null;
  attachment_url: string | null;
  attachment_type: string | null;
  mentioned_user_ids: string[];
  created_at: string;
};

/** הודעה עם שולח — מה שמסך הצ'אט מקבל */
export type ChatMessage = Message & {
  sender: Pick<Profile, "id" | "full_name" | "avatar_url"> | null;
};

/** מה שמחזירה get_leaderboard — דירוג בלבד, בלי ספירת משימות (docs/02 §3.3) */
export type LeaderboardRow = {
  rank: number;
  team_id: string;
  team_name: string;
  team_color: string;
  team_animal: string | null;
};

/**
 * מה שמחזירה get_team_state.
 * `station.name` / `backstory` / `task_content` מגיעים null עד שהשרת
 * אימת הגעה לרדיוס — אסור להסתמך על הסתרה בקליינט.
 */
export type GameStateName =
  | "clue"
  | "task"
  | "awaiting_approval"
  | "finished"
  | "no_stations";

export type GameState = {
  team: { id: string; name: string; color: string; animal: string | null };
  race: { id: string; name: string; status: RaceStatus };
  state: GameStateName;
  station: {
    id: string;
    position: number;
    clue: string | null;
    lat: number;
    lng: number;
    radius_m: number;
    completion_type: CompletionType;
    name: string | null;
    backstory: string | null;
    task_content: TaskContent | null;
  } | null;
  proof_url?: string | null;
};

export type ArriveResult = { arrived: boolean; distance_m: number };
export type CompleteResult = {
  ok: boolean;
  error?: string;
  awaiting_approval?: boolean;
};
export type FinishResult = {
  winner: {
    team_id: string;
    name: string;
    color: string;
    animal: string | null;
    members: string[];
  } | null;
};
