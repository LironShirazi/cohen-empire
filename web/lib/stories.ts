/**
 * סטוריז — טיפוסים וקבועים שמשותפים לשרת ולקליינט (בלי Supabase).
 */

/** סטורי אחד, מוכן לתצוגה — ה-URL כבר נגזר מהנתיב בשרת */
export type StoryItem = {
  id: string;
  kind: "photo" | "text";
  url: string | null;
  storage_path: string | null;
  caption: string | null;
  color: number | null;
  created_at: string;
};

export type StoryViewer = {
  viewer_id: string;
  name: string;
  avatar_url: string | null;
  viewed_at: string;
};

/** כל הסטוריז של אדם אחד — עיגול אחד בפס */
export type StoryGroup = {
  user_id: string;
  name: string;
  avatar_url: string | null;
  /** מאיפה התמונה בעיגול — כך הצופה יודע למה הוא רואה אותה */
  avatar_source: "tree" | "google" | null;
  items: StoryItem[];
  /** כל הסטוריז של האדם הזה כבר נצפו ע"י הקורא — טבעת אפורה */
  seen: boolean;
  /** רק בקבוצה של הקורא עצמו: מי צפה, לפי סטורי */
  viewers?: Record<string, StoryViewer[]>;
};

export type StoryFeed = {
  me: {
    user_id: string;
    name: string;
    avatar_url: string | null;
    avatar_source: "tree" | "google" | null;
  };
  mine: StoryGroup | null;
  others: StoryGroup[];
};

export const STORY_SECONDS = 5;
export const STORY_TTL_HOURS = 24;
export const STORY_CAPTION_MAX = 80;
/** 1080px לפי הסקיצה — מספיק למסך טלפון מלא, 80–200KB לתמונה */
export const STORY_MAX_PX = 1080;
export const STORIES_BUCKET = "stories";

/**
 * רקעים לסטורי טקסט. בשורה נשמר **האינדקס** בלבד (0024, `color`),
 * ולכן הסדר כאן הוא חוזה — מוסיפים רק בסוף, לא משנים ולא מוחקים.
 * כולם כהים מספיק לטקסט לבן.
 */
export const STORY_COLORS = [
  "linear-gradient(160deg, #16305f, #0b1b3f 60%)", // קוסמי
  "linear-gradient(160deg, #e4002b, #8f0019)", // אדום המירוץ
  "linear-gradient(160deg, #1f6b4a, #0f3d29)", // ירוק
  "linear-gradient(160deg, #7a3e9d, #3e1d55)", // סגול
  "linear-gradient(160deg, #2e86de, #174a80)", // כחול
  "linear-gradient(160deg, #b5651d, #6b3510)", // חום-כתום
] as const;

export function storyBackground(color: number | null): string {
  return STORY_COLORS[color ?? 0] ?? STORY_COLORS[0];
}

/** "לפני 3 שע׳" — כמו בסקיצה. מקבל `now` כדי שיהיה טהור */
export function timeAgo(iso: string, now: number): string {
  const minutes = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return "עכשיו";
  if (minutes < 60) return `לפני ${minutes} דק׳`;
  return `לפני ${Math.floor(minutes / 60)} שע׳`;
}

/** "נעלם בעוד 21 שע׳" */
export function timeLeft(iso: string, now: number): string {
  const ms = new Date(iso).getTime() + STORY_TTL_HOURS * 3600000 - now;
  const hours = Math.floor(ms / 3600000);
  if (hours >= 1) return `נעלם בעוד ${hours} שע׳`;
  return `נעלם בעוד ${Math.max(1, Math.ceil(ms / 60000))} דק׳`;
}

/** שם קצר לעיגול — 68px לא מכילים "סבתא טראקי כהן" */
export function shortName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

export function initialOf(name: string): string {
  return name.trim().charAt(0) || "?";
}
