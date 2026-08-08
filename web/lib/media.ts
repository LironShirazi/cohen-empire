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
