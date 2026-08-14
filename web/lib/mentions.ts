/**
 * אזכורים (@) בצ'אט — docs/01 §5, docs/02 §3.8, docs/04 §3.
 *
 * **הטוקן הוא טקסט רגיל.** הבורר מכניס לגוף ההודעה `@<שם מלא>` ושומר
 * את המזהה בנפרד ב-`mentioned_user_ids`; אין תחביר מיוחד בגוף ההודעה.
 * למה: השרת לא מנתח טקסט חופשי (docs/02 §3.8) — המזהים הם מקור האמת
 * להתראה — וההודעה נשארת קריאה גם למי שלא מכיר פורמט טוקן כלשהו.
 *
 * מכאן נובע שההדגשה בתצוגה נגזרת מהצטלבות של השניים: מדגישים `@<שם>`
 * רק עבור מי שבאמת ברשימת המאוזכרים של אותה הודעה. מי שהקליד "@יואב"
 * ביד בלי לבחור מהבורר יראה טקסט רגיל — וגם לא נשלחה לו התראה, אז
 * התצוגה לא משקרת.
 */

export type Mentionable = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  /** מנהל תורן של המירוץ — מסומן 👑 בבורר (docs/04 §3) */
  is_admin: boolean;
};

/**
 * שמות בעברית מכילים רווח ("יואב כהן"), אז אי אפשר לעצור את החיפוש
 * ברווח הראשון כמו בשם משתמש לועזי. במקום זה מגבילים באורך — ואם אחרי
 * רווח כבר אין אף התאמה, הבורר נסגר מעצמו (ראו `matchMentionables`).
 */
const MAX_QUERY = 24;

export type MentionQuery = {
  /** האינדקס של תו ה-@ עצמו בתוך הטקסט */
  start: number;
  /** מה שהוקלד אחרי ה-@ ועד הסמן */
  query: string;
};

/** האם הבורר צריך להיות פתוח עכשיו, ולפי מה לסנן */
export function findMentionQuery(
  text: string,
  caret: number
): MentionQuery | null {
  for (let i = caret - 1; i >= 0 && caret - i <= MAX_QUERY + 1; i -= 1) {
    const char = text[i];
    if (char === "\n") return null;
    if (char !== "@") continue;

    // @ באמצע מילה (כמו בכתובת מייל) הוא לא אזכור
    const before = i > 0 ? text[i - 1] : " ";
    if (!/\s/.test(before)) return null;

    return { start: i, query: text.slice(i + 1, caret) };
  }
  return null;
}

/** סינון תוך כדי הקלדה — קודם מי שהשם שלו מתחיל במה שהוקלד */
export function matchMentionables(
  people: Mentionable[],
  query: string
): Mentionable[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return people;

  // אזכור שהושלם — שם מלא ואחריו רווח — סוגר את הבורר. בלי זה הוא
  // היה נפתח מחדש מיד אחרי בחירה, כי הסמן עדיין "בתוך" הטוקן
  if (
    /\s$/.test(query) &&
    people.some((person) => person.full_name.toLowerCase() === needle)
  ) {
    return [];
  }

  const matches = people.filter((person) => {
    const name = person.full_name.toLowerCase();
    return name.includes(needle);
  });

  return matches.sort((a, b) => {
    const aStarts = a.full_name.toLowerCase().startsWith(needle);
    const bStarts = b.full_name.toLowerCase().startsWith(needle);
    if (aStarts !== bStarts) return aStarts ? -1 : 1;
    return a.full_name.localeCompare(b.full_name, "he");
  });
}

/** הכנסת האזכור לטקסט במקום מה שהוקלד אחרי ה-@ */
export function applyMention(
  text: string,
  mention: MentionQuery,
  person: Mentionable,
  caret: number
): { text: string; caret: number } {
  const token = `@${person.full_name} `;
  const next = text.slice(0, mention.start) + token + text.slice(caret);
  return { text: next, caret: mention.start + token.length };
}

/**
 * מזהי המאוזכרים שעדיין נמצאים בטקסט. נקרא לפני שליחה: אם מחקו את
 * שם האזכור מהגוף, המזהה לא צריך להישלח — אחרת נוצרת התראה על אזכור
 * שלא רואים בהודעה.
 */
export function mentionedIdsIn(text: string, people: Mentionable[]): string[] {
  return people
    .filter((person) => text.includes(`@${person.full_name}`))
    .map((person) => person.id);
}

export type MentionPart = { text: string; mentioned: boolean };

/** פירוק גוף ההודעה לקטעים, כדי להדגיש את האזכורים בתצוגה */
export function splitMentions(
  body: string,
  mentionedIds: string[],
  people: Mentionable[]
): MentionPart[] {
  const names = people
    .filter((person) => mentionedIds.includes(person.id))
    .map((person) => person.full_name)
    // הארוך קודם, אחרת "@דנה" תיבלע בתוך "@דנה כהן"
    .sort((a, b) => b.length - a.length);

  if (names.length === 0) return [{ text: body, mentioned: false }];

  const pattern = new RegExp(
    `@(?:${names.map(escapeRegExp).join("|")})`,
    "g"
  );

  const parts: MentionPart[] = [];
  let index = 0;
  for (const match of body.matchAll(pattern)) {
    if (match.index > index) {
      parts.push({ text: body.slice(index, match.index), mentioned: false });
    }
    parts.push({ text: match[0], mentioned: true });
    index = match.index + match[0].length;
  }
  if (index < body.length) {
    parts.push({ text: body.slice(index), mentioned: false });
  }
  return parts;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
