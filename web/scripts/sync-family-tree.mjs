/**
 * מעתיק את `family-tree/` משורש הריפו ל-`web/public/family-tree/`, כדי
 * שהכפתור 🌳 בדף הבית יעבוד גם בפרודקשן: Vercel בונה את `web/` בלבד,
 * ולכן המודול בשורש פשוט לא מוגש (הקישור החזיר 404).
 *
 * **זה פתרון ביניים.** בשלב 3 המודול עובר לתוך האפליקציה כ-route אמיתי
 * (docs/06 §4) ואז הסקריפט הזה נמחק. עד אז — כל שינוי ב-`family-tree/`
 * מחייב `npm run sync:family-tree`, אחרת מה שרואים בפרודקשן ישן.
 *
 * ההבדל היחיד בין המקור לעותק: כפתור הבית. במודול העצמאי הוא
 * `../index.html` (כדי שייפתח גם ישירות מהדיסק), ובאפליקציה הוא `/`.
 */
import { cp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const web = dirname(dirname(fileURLToPath(import.meta.url)));
const source = join(dirname(web), "family-tree");
const target = join(web, "public", "family-tree");

await rm(target, { recursive: true, force: true });
await cp(source, target, { recursive: true });

const indexPath = join(target, "index.html");
const html = await readFile(indexPath, "utf8");
const patched = html.replace('href="../index.html"', 'href="/"');
if (patched === html) {
  throw new Error(
    "כפתור הבית לא נמצא ב-index.html — הסקריפט מעתיק מודול שהשתנה, צריך לעדכן אותו"
  );
}
await writeFile(indexPath, patched);

console.log("family-tree → web/public/family-tree ✔");
