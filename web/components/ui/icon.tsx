import type { CSSProperties, ReactNode } from "react";

/**
 * סט האייקונים של האפליקציה — "הצעת אייקונים" ב-claude-design.
 *
 * ⚠️ **אין אימוג׳י בממשק.** אימוג׳י נראה אחרת בכל מכשיר, לא מקבל
 * צבע מהטקסט שלידו ולא נקרא כאייקון ממשק. כאן קו אחד: רשת 24,
 * עובי 1.9, קצוות מעוגלים, `currentColor` — האייקון יורש את צבע
 * הטקסט, ולכן אותו רכיב עובד על כפתור אדום, על נייבי ועל נייר.
 *
 * שני גדלים בלבד: 20 בתוך טקסט ושבבים, 24 בכפתורים ובכותרות.
 * אייקון אחד לכל היותר בכפתור. אימוג׳י שהיה קישוט בתוך משפט
 * (״יצאנו לדרך! 🏃״) לא הפך לאייקון — הוא פשוט ירד.
 *
 * חמישה מקרים **אינם** אייקון (ראו הרכיבים בהמשך הקובץ): חיות
 * הקבוצות ← `TeamGlyph`, מקומות 1·2·3 ← `RankBadge`, שידור חי ←
 * `LiveDot`, דגל הסיום ← `FinishFlag`, וסבא וסבתא ← תמונה.
 *
 * העותק ל-vanilla של העץ המשפחתי: `public/family-tree/js/icons.js`.
 * שינוי של path כאן — לשנות גם שם.
 */
const paths = {
  // פעולות
  search: <><circle cx="11" cy="11" r="6.5" /><path d="M15.8 15.8 21 21" /></>,
  edit: <><path d="M4 20h4L20 8a2.8 2.8 0 0 0-4-4L4 16v4z" /><path d="M14.5 5.5 18.5 9.5" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  fit: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
  save: <><path d="M5 4h11l3 3v13H5z" /><path d="M9 4v5h6V4" /><path d="M8 20v-6h8v6" /></>,
  trash: <><path d="M4 7h16" /><path d="M9 7V4h6v3" /><path d="M6.5 7l1 13h9l1-13" /><path d="M10.5 11v6M13.5 11v6" /></>,
  share: <><circle cx="18" cy="6" r="2.6" /><circle cx="6" cy="12" r="2.6" /><circle cx="18" cy="18" r="2.6" /><path d="M15.6 7.3 8.4 10.7M8.4 13.3l7.2 3.4" /></>,
  download: <><path d="M12 4v10" /><path d="M8 10.5 12 14.5 16 10.5" /><path d="M4 17v3h16v-3" /></>,
  reset: <><path d="M20 12a8 8 0 1 1-2.6-5.9" /><path d="M20 4v4h-4" /></>,
  shuffle: <><path d="M3 7h5l8 10h4M3 17h5l2.6-3.2" /><path d="M17 14l3 3-3 3M17 4l3 3-3 3" /></>,
  check: <path d="M4.5 12.5 9.5 17.5 19.5 6.5" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  // ב-RTL "חזרה" מצביע ימינה ו"קדימה" שמאלה
  back: <path d="M9.5 5 16.5 12l-7 7" />,
  forward: <path d="M14.5 5 7.5 12l7 7" />,
  up: <path d="M5 15.5 12 8.5l7 7" />,
  down: <path d="M5 8.5 12 15.5l7-7" />,
  play: <path d="M8 5.5v13l10.5-6.5z" fill="currentColor" />,

  // מקום, ניווט ומירוץ
  pin: <><path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11z" /><circle cx="12" cy="10" r="2.6" /></>,
  map: <><path d="M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20z" /><path d="M9 4v13.5M15 6.5V20" /></>,
  navigate: <path d="M21 3 3 10.5l8 2.5 2.5 8z" />,
  pushpin: <><path d="M9 3.5h6l-1 5 3.5 4.5H6.5L10 8.5z" /><path d="M12 13v7.5" /></>,
  key: <><circle cx="7.5" cy="12" r="3.5" /><path d="M11 12h9" /><path d="M17.5 12v3.5M14.5 12v2.5" /></>,
  lock: <><rect x="4.5" y="10" width="15" height="10.5" rx="2.5" /><path d="M8 10V7.5a4 4 0 0 1 8 0V10" /></>,
  hidden: <><path d="M3 12s3.6-6 9-6 9 6 9 6-3.6 6-9 6-9-6-9-6z" /><path d="M4.5 19.5 19.5 4.5" /></>,
  bolt: <path d="M13.5 3 6 13.5h5l-1.5 7.5L18 10.5h-5z" />,
  home: <><path d="M4 11 12 4l8 7v9H4z" /><path d="M9.5 20v-5.5h5V20" /></>,
  flag: <><path d="M6.5 21V3.5" /><path d="M6.5 4.5h12l-2.6 4.2 2.6 4.2h-12z" /></>,

  // אנשים, משפחה והישגים
  users: <><circle cx="9" cy="9" r="3.4" /><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" /><path d="M16 6.2a3.4 3.4 0 0 1 0 5.6M17.5 14.8c2 .8 3.5 2.6 3.5 5.2" /></>,
  me: <><circle cx="11" cy="8" r="3.4" /><path d="M4.5 20c0-3.5 2.9-5.8 6.5-5.8s6.5 2.3 6.5 5.8" /><circle cx="19" cy="6" r="2.4" fill="currentColor" stroke="none" /></>,
  child: <><circle cx="12" cy="8.5" r="2.8" /><path d="M7.8 20c0-2.9 1.9-4.8 4.2-4.8s4.2 1.9 4.2 4.8" /></>,
  tree: <><rect x="9" y="3" width="6" height="4.6" rx="1.6" /><rect x="2.5" y="16" width="6" height="4.6" rx="1.6" /><rect x="15.5" y="16" width="6" height="4.6" rx="1.6" /><path d="M12 7.6v4.4M5.5 16v-4h13v4" /></>,
  heart: <path d="M12 20.3S3.8 15.2 3.8 9.9A4.4 4.4 0 0 1 12 7.1a4.4 4.4 0 0 1 8.2 2.8c0 5.3-8.2 10.4-8.2 10.4z" fill="currentColor" stroke="none" />,
  crown: <path d="M3.5 18.5h17L19.2 8l-4.4 3.6L12 5.2 9.2 11.6 4.8 8z" />,
  trophy: <><path d="M8 4h8v5.5a4 4 0 0 1-8 0z" /><path d="M8 5.5H5v2a3 3 0 0 0 3 3M16 5.5h3v2a3 3 0 0 1-3 3" /><path d="M12 13.5v3.5M8.5 20h7" /></>,
  hall: <><path d="M3.5 9 12 4l8.5 5" /><path d="M6 9v9M10 9v9M14 9v9M18 9v9" /><path d="M3 20.5h18" /></>,

  // תקשורת, מדיה וניהול
  chat: <path d="M20 12.3c0 3.9-3.6 7-8 7-1 0-2-.2-2.9-.5L4.6 20.5l1.2-3.6A6.5 6.5 0 0 1 4 12.3c0-3.9 3.6-7 8-7s8 3.1 8 7z" />,
  megaphone: <><path d="M4 10.5 15 6v12L4 13.5z" /><path d="M15 9.5a3 3 0 0 1 0 5" /><path d="M7 13.2v5.3h3V14.4" /></>,
  phone: <path d="M7 3.5 9.5 8 7.5 10a12 12 0 0 0 6 6l2-2 4.5 2.5-1 3c-6.5 1-15-7.5-14-14z" />,
  camera: <><path d="M3.5 8.5h3.2L8.2 6h7.6l1.5 2.5h3.2V19h-17z" /><circle cx="12" cy="13.5" r="3.4" /></>,
  video: <><rect x="3" y="7" width="12" height="10" rx="2.5" /><path d="M15 11.5 21 8v8l-6-3.5z" /></>,
  mic: <><rect x="9.5" y="3" width="5" height="10" rx="2.5" /><path d="M6 11.5a6 6 0 0 0 12 0" /><path d="M12 17.5V21" /></>,
  attach: <path d="M17 8.6 9.6 16a3.2 3.2 0 0 0 4.5 4.5l6.4-6.4a5.4 5.4 0 0 0-7.6-7.6L6.2 13.2" />,
  screen: <><rect x="3" y="4.5" width="18" height="12" rx="2.5" /><path d="M9 20h6M12 16.5V20" /></>,
  sliders: <><path d="M4 8h9M18.5 8H20M4 16h3.5M12.5 16H20" /><circle cx="15.6" cy="8" r="2.4" /><circle cx="10" cy="16" r="2.4" /></>,
  chart: <><path d="M4 20h16" /><path d="M7 20v-6M12 20V6M17 20v-9" /></>,
  scale: <><path d="M12 4.5V20M8 20h8" /><path d="M5 8.5h14" /><path d="M5 8.5 2.8 13a3 3 0 0 0 4.4 0z" /><path d="M19 8.5 16.8 13a3 3 0 0 0 4.4 0z" /></>,
  warning: <><path d="M12 4 21 20H3z" /><path d="M12 10v4.5" /><circle cx="12" cy="17.6" r=".9" fill="currentColor" stroke="none" /></>,
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof paths;

/**
 * אותם אייקונים כמחרוזת HTML — לסמנים של Leaflet (`L.divIcon`), שמקבלים
 * HTML ולא רכיב React. רק מה שהמפות צריכות.
 */
const markupPaths = {
  pin: '<path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11z"/><circle cx="12" cy="10" r="2.6"/>',
  flag: '<path d="M6.5 21V3.5"/><path d="M6.5 4.5h12l-2.6 4.2 2.6 4.2h-12z"/>',
} as const;

export function iconMarkup(
  name: keyof typeof markupPaths,
  size: number,
  { color = "currentColor", fill = "none" }: { color?: string; fill?: string } = {}
): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:block">${markupPaths[name]}</svg>`;
}

// אייקונים שהקו שלהם עבה יותר בהצעה — סימני אישור/סגירה קצרים
const heavier: Partial<Record<IconName, number>> = { check: 2.3, close: 2.2 };

export function Icon({
  name,
  size = 20,
  className = "",
  style,
  label,
}: {
  name: IconName;
  /** 20 בתוך טקסט ושבבים, 24 בכפתורים ובכותרות */
  size?: number;
  className?: string;
  style?: CSSProperties;
  /** רק לאייקון שעומד לבד בלי טקסט — אחרת הוא דקורטיבי */
  label?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={heavier[name] ?? 1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`inline-block flex-none ${className}`}
      style={style}
      {...(label
        ? { role: "img", "aria-label": label }
        : { "aria-hidden": true })}
    >
      {paths[name]}
    </svg>
  );
}

/**
 * אייקון בתוך משבצת — האריחים בדף הבית, מסכים ריקים וכותרות גדולות.
 */
export function IconTile({
  name,
  size = 64,
  className = "bg-bg-2 text-ink",
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={`inline-flex flex-none items-center justify-center rounded-[28%] ${className}`}
      style={{ width: size, height: size }}
    >
      <Icon name={name} size={Math.round(size * 0.55)} />
    </span>
  );
}

/**
 * 🏁 → הדגל הצהוב של המירוץ — הסמל של המירוץ עצמו ולא דגל
 * שחור־לבן גנרי.
 */
export function FinishFlag({ size = 64 }: { size?: number }) {
  return <IconTile name="flag" size={size} className="bg-yellow text-ink" />;
}

/**
 * 🟢 / ● → נקודת צבע אמיתית. יורשת את צבע הטקסט אלא אם קיבלה צבע.
 */
export function LiveDot({
  className = "",
  color,
  pulse = false,
}: {
  className?: string;
  /** ברירת המחדל: צבע הטקסט */
  color?: string;
  pulse?: boolean;
}) {
  return (
    <span
      aria-hidden
      className={`inline-block size-2.5 flex-none rounded-full ${
        pulse ? "animate-pulse" : ""
      } ${className}`}
      style={{ background: color ?? "currentColor" }}
    />
  );
}

const rankTones: Record<number, { bg: string; border: string; ink: string }> = {
  1: { bg: "var(--gold)", border: "#c99400", ink: "#1a1206" },
  2: { bg: "#d9d9d9", border: "#a9a9a9", ink: "#3a3a3a" },
  3: { bg: "#e0a879", border: "#b77c48", ink: "#4a2a0c" },
};

/**
 * 🥇🥈🥉 → עיגול דירוג עם ספרה. קריא בכל גודל, ועובד גם למקום 4.
 */
export function RankBadge({ rank, size = 40 }: { rank: number; size?: number }) {
  const tone = rankTones[rank];
  return (
    <span
      className="inline-flex flex-none items-center justify-center rounded-full font-display"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.48),
        background: tone?.bg ?? "rgba(255,255,255,.14)",
        border: `2.5px solid ${tone?.border ?? "rgba(255,255,255,.3)"}`,
        color: tone?.ink ?? "currentColor",
      }}
    >
      {rank}
    </span>
  );
}

/**
 * האות שמייצגת קבוצה במקום אימוג׳י החיה.
 *
 * ⚠️ `animal` ב-DB נשאר "🐬 דולפינים" — הוא שם הקבוצה, לא אייקון,
 * ושורות קיימות כבר שמורות כך. מה שמשתנה הוא התצוגה: האות הראשונה
 * של שם החיה (ד), ואם אין חיה — של שם הקבוצה.
 */
export function teamInitial(team: {
  animal?: string | null;
  name?: string | null;
}): string {
  const source = animalName(team.animal) || team.name?.trim() || "";
  const letter = source.match(/[\p{L}\p{N}]/u)?.[0];
  return letter ?? "";
}

/** "🐬 דולפינים" → "דולפינים" (בלי האימוג׳י) */
export function animalName(animal?: string | null): string {
  return (animal ?? "").replace(/^[^\p{L}\p{N}]+/u, "").trim();
}

/**
 * תוכן אריח החיה של קבוצה: האות בפונט התצוגה, בגוון כהה של צבע
 * הקבוצה. המשבצת עצמה (רקע + מסגרת בצבע הקבוצה) נשארת בכל מסך
 * כפי שהייתה — זה רק מה שבתוכה. בלי אות — הדגל.
 */
export function TeamGlyph({
  team,
  onDark = false,
  className = "",
}: {
  team: { animal?: string | null; name?: string | null; color?: string | null };
  /** על רקע קוסמי — גוון בהיר של צבע הקבוצה במקום כהה */
  onDark?: boolean;
  className?: string;
}) {
  const letter = teamInitial(team);
  if (!letter) return <Icon name="flag" size={22} className={className} />;
  return (
    <span
      aria-hidden
      className={`font-display leading-none ${className}`}
      style={
        team.color
          ? {
              color: onDark
                ? `color-mix(in srgb, ${team.color} 40%, #fff)`
                : `color-mix(in srgb, ${team.color} 62%, #000)`,
            }
          : undefined
      }
    >
      {letter}
    </span>
  );
}
