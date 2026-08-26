/**
 * צילום מסך של האפליקציה ברוחב מובייל אמיתי, להשוואה מול הסקיצות.
 *
 * הרצה (עם `npm run start` או `npm run dev` פעיל):
 *   node scripts/shoot.mjs /team out.png
 *   node scripts/shoot.mjs /team out.png 402 900
 *
 * ⚠️ **למה iframe ולא `--window-size`.** ל-Chrome headless יש רוחב
 * viewport מינימלי של 500px: `--window-size=402` מרנדר את העמוד
 * ב-500 ואז **חותך** את התמונה ל-402. ב-RTL זה מוריד את הצד הימני,
 * והתוצאה נראית בדיוק כמו באג פריסה שאינו קיים. עמוד עוטף עם iframe
 * ברוחב קבוע נותן ל-402 להיות ה-viewport באמת — אותו תרגיל שהסקיצות
 * עושות עם מסגרת ה-IOSDevice (402×874).
 */
import { spawn } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME =
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
// הארגומנט האחרון הוא "כמה זמן וירטואלי לתת לעמוד לפני הצילום".
// לאנימציות מחזוריות זה למעשה בורר הפריים: רצועת ההליכה חוצה ב-9
// שניות, וב-1500ms היא עדיין מחוץ למסך.
const [route = "/", out = "shot.png", w = "402", h = "874", budget = "1500"] =
  process.argv.slice(2);

const width = Number(w);
const height = Number(h);
const url = route.includes("://") ? route : `http://localhost:3000${route}`;

const dir = mkdtempSync(join(tmpdir(), "shoot-"));
const harness = join(dir, "frame.html");
writeFileSync(
  harness,
  `<!doctype html><meta charset="utf-8"><style>
     html,body{margin:0;background:#EFE7D2}
     iframe{width:${width}px;height:${height}px;border:0;display:block}
   </style><iframe src="${url}"></iframe>`
);

// חלון רחב מהמסגרת (מעל מינימום ה-500), והחיתוך ל-width נותן בדיוק את ה-iframe
const args = [
  "--headless=new",
  "--disable-gpu",
  "--hide-scrollbars",
  `--window-size=${width},${height}`,
  `--screenshot=${out}`,
  // זמן לפונטים ולציור הראשון — בלעדיו נתפס לפעמים מסך לבן
  `--virtual-time-budget=${Number(budget)}`,
  harness,
];

const chrome = spawn(CHROME, args, { stdio: ["ignore", "ignore", "pipe"] });
let err = "";
chrome.stderr.on("data", (d) => (err += d));
chrome.on("close", (code) => {
  if (code !== 0 && !err.includes("written to file")) {
    console.error(err.trim().split("\n").slice(-3).join("\n"));
  }
  console.log(`${url} → ${out} (${width}×${height})`);
});
