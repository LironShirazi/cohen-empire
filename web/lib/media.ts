// סיומות הווידאו שדפדפני מובייל מנגנים בלי קידוד מחדש
const videoExtensions = ["mp4", "webm", "mov", "m4v", "ogv"];

/**
 * וידאו או תמונה? השדה `media` ב-task_content שומר URL בלבד, אז הסוג
 * נגזר מהסיומת. Storage מחזיר URL עם שם הקובץ המקורי, כולל הסיומת.
 */
export function isVideoUrl(url: string): boolean {
  const path = url.split("?")[0] ?? "";
  const extension = path.split(".").pop()?.toLowerCase() ?? "";
  return videoExtensions.includes(extension);
}

export type AttachmentKind = "image" | "video" | "audio" | "file";

/**
 * איך להציג קובץ שצורף לצ'אט. הצ'אט שומר את ה-MIME המדווח
 * (`attachment_type`), אז הוא הקובע; הסיומת היא רק גיבוי להודעות
 * שנשמרו בלי סוג.
 */
export function attachmentKind(
  type: string | null,
  url: string
): AttachmentKind {
  if (type?.startsWith("image/")) return "image";
  if (type?.startsWith("video/")) return "video";
  if (type?.startsWith("audio/")) return "audio";
  if (!type && isVideoUrl(url)) return "video";
  return "file";
}
