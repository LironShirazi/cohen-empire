import { initialOf } from "@/lib/stories";

/**
 * העיגול של אדם בפס הסטוריז — תמונה (מהעץ או מ-Google) או האות
 * הראשונה. בלי `next/image`: התמונות מ-Supabase Storage ומ-Google,
 * ובפס של 58px אין מה לחסוך.
 */
export function StoryAvatar({
  name,
  url,
  size = 58,
  border = "2.5px solid var(--navy)",
}: {
  name: string;
  url: string | null;
  size?: number;
  border?: string;
}) {
  const style = { width: size, height: size, border };
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        referrerPolicy="no-referrer"
        className="block flex-none rounded-full bg-bg-2 object-cover"
        style={style}
      />
    );
  }
  return (
    <span
      aria-hidden
      className="flex flex-none items-center justify-center rounded-full bg-story-avatar font-extrabold text-story-avatar-ink"
      style={{ ...style, fontSize: Math.round(size * 0.38) }}
    >
      {initialOf(name)}
    </span>
  );
}

/**
 * הטבעת: צהוב־אדום (צבעי המצפן) = יש משהו שלא ראית; אפורה = נצפה.
 * `none` — בלי טבעת בכלל (העיגול שלי כשאין לי סטורי).
 */
export function StoryRing({
  state,
  children,
}: {
  state: "new" | "seen" | "none";
  children: React.ReactNode;
}) {
  const background =
    state === "new"
      ? "var(--story-ring)"
      : state === "seen"
        ? "rgba(255,255,255,.28)"
        : "transparent";
  return (
    <span className="block rounded-full p-[3px]" style={{ background }}>
      {children}
    </span>
  );
}
