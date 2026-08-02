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

export type Station = {
  id: string;
  race_id: string;
  name: string;
  backstory: string | null;
  clue: string | null;
  task_content: string | null;
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
    task_content: string | null;
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
