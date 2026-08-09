/**
 * מרחק Haversine במטרים.
 *
 * זהה לפונקציה haversine_m ב-DB — אבל זו שבשרת היא הקובעת.
 * כאן זה רק למד המרחק החי במסך ("עוד 340 מ׳"), כדי לא להציף את
 * השרת בקריאה על כל דגימת GPS. הפתיחה עצמה תמיד מאומתת בשרת
 * (docs/02-architecture.md §3.1).
 */
export function distanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(a));
}

/** אותה הרחבת סף כמו בשרת: דיוק GPS גרוע מרחיב את הרדיוס, עד 100 מ׳ */
export function allowedRadius(radiusM: number, accuracyM: number | null) {
  return radiusM + Math.min(accuracyM ?? 0, 100);
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} מ׳`;
  return `${(meters / 1000).toFixed(1)} ק״מ`;
}
