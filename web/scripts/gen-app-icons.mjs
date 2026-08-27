// יצירת אייקוני האפליקציה ותמונת השיתוף מתוך נכסי המותג.
// הרצה מתוך web/:  node scripts/gen-app-icons.mjs
//
// למה סקריפט ולא נכסים שנשמרו ידנית: הפיצול בין הסמל לתמונה מכוון
// (ראו CLAUDE.md §13), וכשמישהו יחליף את `profile-image.png` צריך
// שיהיה ברור מאיפה כל קובץ נגזר ובאיזה רקע.
//
// `sharp` מגיע מ-`optionalDependencies` של Next ולכן כבר מותקן; הוא בכוונה
// לא נוסף ל-devDependencies — הסקריפט רץ ידנית פעם בכמה חודשים, ותוספת
// שתוציא את `package-lock.json` מסנכרון תשבור `npm ci` בוורסל.
import sharp from "sharp";

const BRAND = "public/brand";
const NAVY = { r: 0x0b, g: 0x1b, b: 0x3f, alpha: 1 }; // --navy

// favicon — הסמל בסטנסיל. שתי מידות, כדי שהדפדפן לא יקטין 192 ל-16 בעצמו
for (const [out, size] of [
  ["app/icon.png", 32],
  ["app/icon1.png", 192],
]) {
  await sharp(`${BRAND}/emblem.png`)
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .sharpen()
    .png()
    .toFile(out);
}

// אייקון מסך הבית — התמונה על רקע הנייבי.
// `removeAlpha` חובה: iOS לא מכבד שקיפות ומרנדר שחור במקומה
const APPLE = 180;
const medallion = await sharp(`${BRAND}/profile-image.png`)
  .resize(Math.round(APPLE * 0.94), Math.round(APPLE * 0.94))
  .toBuffer();
await sharp({ create: { width: APPLE, height: APPLE, channels: 3, background: NAVY } })
  .composite([{ input: medallion, gravity: "center" }])
  .removeAlpha()
  .png()
  .toFile("app/apple-icon.png");

// תצוגה מקדימה לקישור משותף — 1200×630, היחס שכל הפלטפורמות מציגות בלי לחתוך.
//
// ⚠️ **הדגל נכנס שלם (`contain`) ולא ממולא (`cover`).** הוא 1600×1066
// (יחס 1.50) מול 1.905 של ה-OG, ומילוי היה חותך 226px מהגובה —
// כלומר בדיוק את "האימפריה" למעלה ואת "מירוץ עצמאות" למטה, שתי
// המילים שבשבילן שולחים את הקישור. לכן הוא מוקטן לגובה ומרופד
// בצהוב הדגל לרוחב.
//
// ⚠️ **הפס השחור מוארך ידנית אל שני הקצוות.** בדגל המקורי הוא רץ
// מקצה לקצה; בתוך ריפוד ה-`contain` הוא היה נעצר באמצע ומשאיר שתי
// רצועות צהובות בצדדים — מה שנראה כמו תמונה חתוכה ולא כמו דגל.
// שורות הפס נמדדו מהנכס עצמו (`x=1` בעמודה השמאלית, אחרי ההקטנה).
const OG_W = 1200;
const OG_H = 630;

const flagMeta = await sharp(`${BRAND}/yellow-flag.jpg`).metadata();
const flagW = Math.round((flagMeta.width / flagMeta.height) * OG_H);
const flag = await sharp(`${BRAND}/yellow-flag.jpg`)
  .resize(flagW, OG_H, { fit: "fill" })
  .toBuffer();
const gutter = Math.round((OG_W - flagW) / 2);

// איתור הפס: העמודה השמאלית ביותר של הדגל שחורה רק בגובה הפס
const { data, info } = await sharp(flag).raw().toBuffer({ resolveWithObject: true });
const darkRows = [];
for (let y = 0; y < info.height; y++) {
  const i = (y * info.width + 1) * info.channels;
  if (data[i] < 90 && data[i + 1] < 90) darkRows.push(y);
}
const bandTop = darkRows[0];
const bandH = darkRows[darkRows.length - 1] - bandTop + 1;

// הצהוב נדגם מהדגל עצמו ולא מ-`--yellow`: הצהוב שבקובץ חם במעט
// מהטוקן, ובריפוד היה נראה כתפר אנכי לאורך כל התמונה
const px = (x, y) => {
  const i = (y * info.width + x) * info.channels;
  return { r: data[i], g: data[i + 1], b: data[i + 2] };
};
const YELLOW = { ...px(4, 4), alpha: 1 };
const BAND = px(4, bandTop + Math.round(bandH / 2));
const bandStrip = await sharp({
  create: {
    width: gutter + 2, // ‎+2 כדי שלא תישאר תפר של פיקסל בין הריפוד לדגל
    height: bandH,
    channels: 3,
    background: BAND, // השחור של הדגל עצמו, נדגם מתוכו
  },
})
  .png()
  .toBuffer();

await sharp({ create: { width: OG_W, height: OG_H, channels: 3, background: YELLOW } })
  .composite([
    { input: flag, left: gutter, top: 0 },
    { input: bandStrip, left: 0, top: bandTop },
    { input: bandStrip, left: OG_W - gutter - 2, top: bandTop },
  ])
  .removeAlpha()
  .png({ compressionLevel: 9 })
  .toFile("app/opengraph-image.png");

for (const f of [
  "app/icon.png",
  "app/icon1.png",
  "app/apple-icon.png",
  "app/opengraph-image.png",
]) {
  const m = await sharp(f).metadata();
  console.log(f, `${m.width}x${m.height}`, m.hasAlpha ? "alpha" : "opaque");
}
