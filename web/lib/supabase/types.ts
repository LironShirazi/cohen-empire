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
 * `mentioned_user_ids` נכתב ע"י בורר ה-@ במחבר (ולא מניתוח טקסט בשרת,
 * docs/02 §3.8), והטריגר `handle_message_mentions` הופך אותו להתראות.
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

/**
 * המיקום האחרון שדווח מהקבוצה (docs/04 §4) — שורה אחת לקבוצה.
 * לתצוגה במפת המנהל בלבד: החלטת "הגעתם" נשענת על `arrive_at_station`
 * ולא על השדות האלה (docs/02 §3.1).
 */
export type TeamLocation = {
  team_id: string;
  lat: number;
  lng: number;
  accuracy_m: number | null;
  reported_by: string | null;
  updated_at: string;
};

/**
 * עלה בעץ המשפחתי (docs/03, docs/06 §4). הטבלה קיימת מ-0001 אבל
 * נפתחה לכתיבה רק ב-0010, כשהעץ עבר מ-localStorage ל-Supabase.
 *
 * `profile_id` הוא "זה אני" — הקישור למשתמש רשום, ייחודי, והשדה
 * היחיד בשורה שמוגן: כל בן משפחה עורך כל עלה (שם, תמונה, קשרים),
 * אבל את הסימון הזה רק בעליו יכול לתת או להסיר (טריגר
 * `guard_family_member_identity`).
 *
 * ⚠️ `father_id`/`mother_id` הם `on delete restrict` — מחיקת עלה עם
 * צאצאים נכשלת ב-23503, וזו ההגנה האמיתית על מבנה העץ.
 */
export type FamilyMember = {
  id: string;
  profile_id: string | null;
  name: string;
  /** מוצג מתחת ללב של בני הזוג. פר-אדם ולא פר-זוג — יש כלות וחתנים
   *  ששמרו על שם המשפחה שלהם (מיגרציה 0011) */
  last_name: string | null;
  gender: "m" | "f" | null;
  birth_year: number | null;
  phone: string | null;
  photo_url: string | null;
  father_id: string | null;
  mother_id: string | null;
  partner_id: string | null;
  is_root: boolean;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * אלבום בגלריה (מיגרציה 0013). היחידה של הגלריה היא אלבום ולא שנה:
 * הגלריה היא של המשפחה לכל שימוש — חתונה, טיול, מירוץ — ולא רק של
 * יום העצמאות.
 *
 * האלבום שייך למשפחה ולא לפותח אותו: כל בן משפחה מוסיף אליו מדיה
 * ומתקן את שמו (כמו עלה בעץ, docs/06 §4). רק המחיקה שמורה לפותח
 * ולמנהל-על — והיא נכשלת כל עוד יש בו מדיה (`on delete restrict`).
 */
export type GalleryAlbum = {
  id: string;
  name: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * פריט מדיה בגלריה (docs/03, docs/04 §26). הטבלה קיימת מ-0001, נפתחה
 * לכתיבה ב-0012, ועברה לאלבומים ב-0013.
 *
 * `storage_path` נשמר כדי שמחיקה תוכל למחוק גם את הקובץ מה-bucket.
 * הסוג (תמונה/סרטון) נגזר מהסיומת ב-`lib/media.ts` ולא נשמר בשורה.
 */
export type GalleryPhoto = {
  id: string;
  album_id: string;
  /** מ-0001. הגלריה כבר לא מסודרת לפי מירוץ ולכן הממשק לא ממלא אותו */
  race_id: string | null;
  url: string;
  storage_path: string | null;
  caption: string | null;
  uploaded_by: string | null;
  created_at: string;
};

export type NotificationType = "mention" | "task_approved" | "admin_broadcast";

/**
 * התראה In-App (docs/03 — `notifications`). נוצרת **רק** בשרת: הטריגר
 * `handle_message_mentions` הוא המקור היחיד, ואין מדיניות INSERT
 * מהקליינט. הקליינט רשאי רק לקרוא את שלו ולסמן `read_at`.
 */
export type Notification = {
  id: string;
  user_id: string;
  type: NotificationType;
  race_id: string | null;
  team_id: string | null;
  message_id: string | null;
  read_at: string | null;
  created_at: string;
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
