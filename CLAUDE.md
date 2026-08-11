# CLAUDE.md — הקשר לכל session פיתוח

קובץ זה נטען אוטומטית בתחילת כל session. תקרא אותו קודם כל דבר אחר — הוא
המפה למסמכי התכנון ולמערכת העיצוב, כדי שלא תצטרך "לגלות" את הפרויקט מחדש
בכל פעם.

## מה זה הפרויקט

**המירוץ למיליון — אימפריית כהן**: אפליקציית ווב Mobile-First, **בעברית בלבד, RTL מלא**,
לניהול המירוץ המשפחתי השנתי של משפחת כהן ביום העצמאות (מסורת 20+ שנה).
פירוט מלא: [README.md](README.md).

**מצב נוכחי: שלב 0 ושלב 1 מומשו, ושלב 2 התחיל.** אפליקציית Next.js חיה
תחת `web/` (ראו §5), הסכמה וה-RPC-ים ב-`supabase/migrations/`. `family-tree/`
הוא עדיין מודול עצמאי ב-vanilla JS שלא חובר ל-Supabase (שלב 3) — ראו §4.

מ**שלב 2** ([docs/05-roadmap.md](docs/05-roadmap.md)) כבר קיים הצ'אט הקבוצתי
בזמן אמת עם צירוף קבצים (§7). נשאר: בורר אזכורים (@) והתראות In-App,
מפת מנהל חיה, חלוקה אוטומטית מאוזנת לקבוצות.

## 1. תמיד תתחיל מכאן — מסמכי התכנון (`docs/`)

לפני שכותבים קוד — לקרוא את אלה, בסדר הזה:

| מסמך | מה יש בו |
|---|---|
| [docs/01-requirements.md](docs/01-requirements.md) | דרישות מלאות: תפקידים/הרשאות, התחברות, ניהול מירוץ, חוויית משתתף, התראות, לידרבורד |
| [docs/02-architecture.md](docs/02-architecture.md) | הסטאק, תרשים ארכיטקטורה, כל ההחלטות המרכזיות (geofencing, RLS, קודים, חלוקה לקבוצות, אזכורים) |
| [docs/03-data-model.md](docs/03-data-model.md) | כל הטבלאות, שדות, יחסים, דוגמאות RLS ב-SQL |
| [docs/04-screens-ux.md](docs/04-screens-ux.md) | כל המסכים וזרימות המשתמש (תואם למה שמצויר ב-`claude-design/`) |
| [docs/05-roadmap.md](docs/05-roadmap.md) | חלוקה לשלבים 0–4. **תמיד תתחיל מהשלב הראשון שלא הושלם** |
| [docs/06-family-tree.md](docs/06-family-tree.md) | פיצ'ר העץ המשפחתי — מימוש קיים + תוכנית הסבה ל-Supabase |

**כלל ברזל:** אם משהו לא ברור מהקוד — התשובה כמעט תמיד נמצאת באחד מהמסמכים
האלה. אל תנחש התנהגות (למשל: לוגיקת לידרבורד, כללי RLS, אלגוריתם חלוקת קבוצות) —
תחפש אותה קודם ב-`docs/`.

## 2. הסטאק (מ-docs/02-architecture.md)

Next.js (React) + TypeScript · Tailwind CSS עם `dir="rtl"` · Supabase
(Postgres + Auth Google + Realtime + Storage + RLS) · Leaflet/OSM למפות ·
Browser Geolocation API · אירוח Vercel. אין שרת נפרד לתחזק.

## 3. מערכת העיצוב (`claude-design/`) — **חובה לפני בניית UI**

עוצב ע"י Claude (design system + מסכי UI). זה מקור האמת היחיד לעיצוב —
**אל תמציא צבעים/מרווחים/פונטים; תשתמש ב-tokens הקיימים.**

### `claude-design/design-system/`
- `styles.css` — **קובץ ה-tokens הראשי** (כל משתני ה-CSS: צבעים, רדיוסים,
  צללים, פונטים, קלאסים בסיסיים ל-btn/card/chip/field וכו'). כשמקימים
  Tailwind config — כל הצבעים/רדיוסים/צללים כאן צריכים להיכנס ל-`theme.extend`.
- `foundations/` — `brand.html`, `colors.html`, `typography.html`: הסבר חזותי
  על השפה העיצובית (Amazing-Race אדום+צהוב, navy קוסמי, זהב; פונטים Rubik
  לגוף + Secular One לכותרות).
- `components/` — רכיבי UI בודדים כ-HTML חי: buttons, inputs, team-card,
  chat, clue-card, clue-reveal, countdown, leaderboard, hall-of-fame,
  quote-card, walking-spinner, characters (סבא וסבתא), admin-participants.
  כל אחד = ה-reference הוויזואלי לרכיב המקביל ב-React.
- `assets/` ו-`uploads/` — תמונות/קריקטורות (סבא וסבתא, דגל צהוב, מצפן) לשימוש בפועל.

### `claude-design/ui-screens/`
- `המירוץ למיליון - סקיצות UI.dc.html` — סקיצות של כל המסכים (דף בית,
  זרימת כניסה בקודים, מסך משימה/רמז, צ'אט, לוח מובילים, מסכי ניהול תורן וכו'),
  בנוי ב-4 "סבבים" (`<section class="dv-turn" id="t1..t4">`). תואם למה שכתוב
  ב-`docs/04-screens-ux.md`.
- `family-tree/` — **עותק תואם** של המודול החי (זהה ל-`/family-tree` בשורש
  הפרויקט), מוטמע כאן ב-iframe בשני וריאנטים (מובייל/מחשב).
- `github.md` — יומן סנכרון בין ה-design tool למקור; מציג אילו מסכים כבר עוצבו
  ומתוך אילו חלקי docs.

**זרימת עבודה מומלצת בכל feature חדש:** לקרוא את חלק ה-UX הרלוונטי ב-`docs/04`,
לפתוח את המסך התואם ב-`claude-design/ui-screens/`, לבדוק את הרכיבים הרלוונטיים
ב-`claude-design/design-system/components/`, ואז לממש ב-React/Tailwind
תוך שימוש ב-tokens מ-`styles.css`.

## 4. `family-tree/` — המודול היחיד שכבר עובד

Vanilla JS, ללא build, נפתח ישירות בדפדפן (`index.html` בשורש או
`family-tree/index.html`). נתונים ב-localStorage (פר-דפדפן, זמני עד חיבור
ל-Supabase). פירוט מלא כולל מודל הנתונים ותוכנית ההסבה: [docs/06-family-tree.md](docs/06-family-tree.md).
כשמסבים אותו ל-Supabase — לשמור על אותו API ב-`js/store.js` (`get/all/childrenOf/...`)
כדי לא לגעת ב-`layout.js`/`render.js`/`ui.js`.

## 5. האפליקציה בפועל (`web/`)

Next.js 16 + App Router. **חשוב:** `web/AGENTS.md` מזהיר שגרסת ה-Next הזו
שונה ממה שמוכר — לקרוא את המדריך הרלוונטי ב-`node_modules/next/dist/docs/`
לפני שכותבים קוד (למשל `PageProps<'/route'>`, `params` כ-Promise,
`refresh()` מ-`next/cache`, ו-`proxy.ts` במקום `middleware.ts`).

```
web/lib/data.ts            שאילתות צד-שרת משותפות (מירוץ פעיל, הקבוצה שלי, תור אישורים)
web/lib/supabase/types.ts  טיפוסי ה-DB — לעדכן ידנית יחד עם כל מיגרציה
web/lib/geo.ts             Haversine למד המרחק בקליינט (השרת הוא הקובע)
web/app/join, /waiting     זרימת הכניסה: קוד משחק ← קוד קבוצה ← אישור מנהל
web/app/team, /team/play   מסך הקבוצה ומהלך המשחק
web/app/admin/[raceId]/…   לוח בקרה, קבוצות, תחנות (מפה), מהלך המירוץ החי
```

### כלל הזהב של שלב 1 — הרשאות ומרחק בשרת

כל שינוי מצב משחק עובר דרך פונקציית RPC ב-`supabase/migrations/0002_phase1_game.sql`
(`security definer` + בדיקת הרשאה בתוך הפונקציה), לא דרך כתיבה ישירה מהקליינט:

- `join_race` / `decide_join_request` — הצטרפות ואישור
- `get_team_state` — **מחזיר את המשימה רק אחרי שהשרת אימת הגעה.**
  `stations` בכלל לא קריאה למשתתפים, כדי ש-`task_content` לא ידלוף
- `arrive_at_station` — מחשב Haversine מול הרדיוס בשרת; `admin_open_station` לעקיפה
- `complete_station` — קורא את `completion_type` מהתחנה ומתעלם ממה שהקליינט טוען
- `get_leaderboard` — מחזיר **דירוג בלבד**, בלי ספירת משימות

לפני שמוסיפים פיצ'ר שנוגע במצב המשחק — לבדוק אם הוא שייך לאחת מהפונקציות
האלה, ולא לעקוף אותן עם כתיבה ישירה מהקליינט.

**אל תקפוץ לשלבים מאוחרים** לפני שהשלב הקודם עובד קצה־לקצה.

## 7. הצ'אט הקבוצתי (שלב 2)

בניגוד למצב המשחק, הצ'אט **לא** עובר דרך RPC: אין מה לאמת מעבר לזהות
השולח וחברות בקבוצה, ושתיהן נאכפות ב-RLS ב-`supabase/migrations/0005_phase2_chat.sql`
(`can_read_team_chat` — כולל מירוץ בארכיון, לקריאה; `can_post_team_chat` —
חבר קבוצה או מנהל תורן, ורק במירוץ שאינו בארכיון). אין מדיניות
UPDATE/DELETE — הודעה שנשלחה נשארת.

```
web/components/chat/chat-room.tsx   הצ'אט עצמו — Realtime + מחבר + העלאת קבצים
web/app/team/chat                   הצ'אט של המשתתף
web/app/admin/[raceId]/chat/…       אותו רכיב, מנקודת המבט של המנהל התורן
```

הקבצים עולים ל-bucket `chat-files` בתיקייה ששמה מזהה הקבוצה — אותה בדיקת
הרשאה כמו שליחת הודעה. `mentioned_user_ids` והטריגר שיוצר ממנו `notifications`
כבר קיימים ב-DB מ-0001; בורר ה-@ בממשק עוד לא נבנה.

## 6. כללים כלליים לכל קוד שנכתב

- עברית בלבד בממשק, RTL מלא (`dir="rtl"`), Mobile-First תמיד קודם למחשב.
- טון עיצובי חם ומשפחתי — לא ממשק "משרדי" (ראו §3).
- לוגיקת אבטחה/הרשאות (מרחק GPS, RLS, יצירת התראות על אזכור) — **תמיד בצד שרת**,
  לא בקליינט בלבד. הפרטים המדויקים ב-[docs/02-architecture.md](docs/02-architecture.md) §3.
- אל תחשוף כמות משימות שהושלמו/נותרו בלידרבורד — רק דירוג (ראו docs/02 §3.3).
- לפני הוספת טבלה/שדה חדש — לבדוק אם הוא כבר מתועד ב-[docs/03-data-model.md](docs/03-data-model.md).
