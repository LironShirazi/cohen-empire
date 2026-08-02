# CLAUDE.md — הקשר לכל session פיתוח

קובץ זה נטען אוטומטית בתחילת כל session. תקרא אותו קודם כל דבר אחר — הוא
המפה למסמכי התכנון ולמערכת העיצוב, כדי שלא תצטרך "לגלות" את הפרויקט מחדש
בכל פעם.

## מה זה הפרויקט

**המירוץ למיליון — אימפריית כהן**: אפליקציית ווב Mobile-First, **בעברית בלבד, RTL מלא**,
לניהול המירוץ המשפחתי השנתי של משפחת כהן ביום העצמאות (מסורת 20+ שנה).
פירוט מלא: [README.md](README.md).

**מצב נוכחי: שלב תכנון + עיצוב בלבד. אין עדיין קוד אפליקציה (לא הוקם Next.js).**
היחיד שכבר "חי" הוא `family-tree/` — מודול עץ משפחתי עצמאי ב-vanilla JS
(ללא build, ללא תלויות), ראה §4 למטה.

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

## 5. איפה להתחיל לפתח בפועל

לפי [docs/05-roadmap.md](docs/05-roadmap.md): **שלב 0 — תשתית** (הקמת Next.js +
TypeScript + Tailwind RTL, חיבור Supabase Auth+DB+RLS בסיסי, פריסה ל-Vercel,
שלד עיצוב מה-tokens). רק אחרי זה — שלב 1 (MVP: אפשר לשחק מירוץ שלם).
אל תקפוץ לשלבים מאוחרים (צ'אט, חלוקה אוטומטית, עץ משפחתי מחובר) לפני שהשלב
הקודם עובד קצה־לקצה.

## 6. כללים כלליים לכל קוד שנכתב

- עברית בלבד בממשק, RTL מלא (`dir="rtl"`), Mobile-First תמיד קודם למחשב.
- טון עיצובי חם ומשפחתי — לא ממשק "משרדי" (ראו §3).
- לוגיקת אבטחה/הרשאות (מרחק GPS, RLS, יצירת התראות על אזכור) — **תמיד בצד שרת**,
  לא בקליינט בלבד. הפרטים המדויקים ב-[docs/02-architecture.md](docs/02-architecture.md) §3.
- אל תחשוף כמות משימות שהושלמו/נותרו בלידרבורד — רק דירוג (ראו docs/02 §3.3).
- לפני הוספת טבלה/שדה חדש — לבדוק אם הוא כבר מתועד ב-[docs/03-data-model.md](docs/03-data-model.md).
