// סיומות הווידאו שדפדפני מובייל מנגנים בלי קידוד מחדש
const videoExtensions = ["mp4", "webm", "mov", "m4v", "ogv"];

// רק סיומות שדפדפן באמת מצייר ב-<img> (בלי heic — הוא ייראה כשבור)
const imageExtensions = ["jpg", "jpeg", "png", "gif", "webp", "avif", "bmp"];

function extensionOf(url: string): string {
  const path = url.split("?")[0] ?? "";
  return path.split(".").pop()?.toLowerCase() ?? "";
}

/**
 * וידאו או תמונה? השדה `media` ב-task_content שומר URL בלבד, אז הסוג
 * נגזר מהסיומת. Storage מחזיר URL עם שם הקובץ המקורי, כולל הסיומת.
 */
export function isVideoUrl(url: string): boolean {
  return videoExtensions.includes(extensionOf(url));
}

export type AttachmentKind = "image" | "video" | "audio" | "file";

/**
 * איך להציג קובץ שצורף לצ'אט. הצ'אט שומר את ה-MIME המדווח
 * (`attachment_type`), אז הוא הקובע — אבל בנייד הדפדפן לא תמיד יודע
 * להגיד מהו (`""` או `application/octet-stream` על סרטון מהגלריה),
 * ואז נופלים לסיומת במקום להציג "קובץ מצורף" גנרי.
 */
export function attachmentKind(
  type: string | null,
  url: string
): AttachmentKind {
  if (type?.startsWith("image/")) return "image";
  if (type?.startsWith("video/")) return "video";
  if (type?.startsWith("audio/")) return "audio";
  if (isVideoUrl(url)) return "video";
  if (imageExtensions.includes(extensionOf(url))) return "image";
  return "file";
}
