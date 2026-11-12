/**
 * ספר המתכונים — לוגיקה טהורה שמשותפת לשרת ולקליינט (בלי Supabase).
 *
 * החיפוש לפי הסקיצה (סבב 7, "מקום בדאטה בייס"): כל מילה שהוקלדה הופכת
 * לביטוי רגולרי — אחרי ניקוי תווים מיוחדים וניקוד — ונבדקת מול שם
 * המתכון ומול שם בעל/ת המתכון, בלי הבדל בין אותיות גדולות לקטנות.
 * כמה מילים — כל אחת צריכה להופיע באחד מהשניים.
 */

/** ניקוד וטעמים, וגרש/גרשיים עבריים ← ASCII — "סבתא" ימצא גם "סַבְתָּא" */
export function normalizeHebrew(text: string): string {
  return text
    .replace(/[֑-ׇ]/g, "")
    .replace(/[׳`]/g, "'")
    .replace(/״/g, '"');
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^$()|[\]\\{}]/g, "\\$&");
}

export function searchPatterns(query: string): RegExp[] {
  return normalizeHebrew(query)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => new RegExp(escapeRegExp(word), "i"));
}

export function matchesRecipe(
  recipe: { name: string; owner_name: string },
  patterns: RegExp[]
): boolean {
  const name = normalizeHebrew(recipe.name);
  const owner = normalizeHebrew(recipe.owner_name);
  return patterns.every((re) => re.test(name) || re.test(owner));
}

/**
 * מחלק טקסט ל[לפני, התאמה, אחרי] לפי ההתאמה הראשונה — להדגשה ב-<mark>.
 *
 * ⚠️ ההתאמה נבדקת על הטקסט **המנורמל**, אבל החיתוך על המקור. זה עובד
 * רק כי הניקוד הוא היחיד שמשנה אורך, ולכן מחשבים מפה של אינדקסים.
 */
export function splitMatch(
  text: string,
  patterns: RegExp[]
): [string, string, string] {
  // אינדקס בטקסט המנורמל ← אינדקס במקור
  const map: number[] = [];
  let normalized = "";
  for (let i = 0; i < text.length; i++) {
    const piece = normalizeHebrew(text[i]);
    for (let k = 0; k < piece.length; k++) map.push(i);
    normalized += piece;
  }
  map.push(text.length);

  for (const re of patterns) {
    const match = re.exec(normalized);
    if (match && match[0]) {
      const start = map[match.index];
      const end = map[match.index + match[0].length];
      return [text.slice(0, start), text.slice(start, end), text.slice(end)];
    }
  }
  return [text, "", ""];
}

export function servingsLabel(servings: number): string {
  return servings === 1 ? "מנה אחת" : `${servings} מנות`;
}

/** תקרות התוכן — זהות ל-check constraints של 0023 */
export const RECIPE_LIMITS = {
  name: 80,
  owner: 60,
  ingredients: 60,
  steps: 40,
  question: 200,
  answer: 400,
  /** הראשית + 9 נוספות (0026) */
  photos: 10,
} as const;

/** הקטנת תמונות: ראשית ושלבים לצפייה מלאה, ממוזערת לשורה ברשימה */
export const RECIPE_PHOTO_PX = 1200;
export const RECIPE_THUMB_PX = 240;
