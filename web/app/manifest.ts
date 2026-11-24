import type { MetadataRoute } from "next";

// ההתקנה למסך הבית (CLAUDE.md §23). הצבעים הם --navy ו---bg של ה-DS.
// `display: standalone` — בלי סרגל כתובת, כמו אפליקציה.
// אין `id` ו-`scope` מפורשים: ברירת המחדל (`start_url` והשורש) נכונה.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "המירוץ למיליון — אימפריית כהן",
    short_name: "אימפריית כהן",
    description: "המירוץ המשפחתי השנתי של משפחת כהן",
    lang: "he",
    dir: "rtl",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0b1b3f",
    theme_color: "#0b1b3f",
    icons: [
      { src: "/brand/pwa-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/pwa-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/brand/pwa-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
