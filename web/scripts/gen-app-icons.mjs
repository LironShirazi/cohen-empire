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

// תצוגה מקדימה לקישור משותף — 1200×630, היחס שכל הפלטפורמות מציגות בלי לחתוך
const OG_W = 1200;
const OG_H = 630;
const ogPhoto = await sharp(`${BRAND}/profile-image.png`)
  .resize(Math.round(OG_H * 0.82), Math.round(OG_H * 0.82))
  .toBuffer();
await sharp({ create: { width: OG_W, height: OG_H, channels: 3, background: NAVY } })
  .composite([{ input: ogPhoto, gravity: "center" }])
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
