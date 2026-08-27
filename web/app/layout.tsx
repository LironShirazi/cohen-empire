import type { Metadata, Viewport } from "next";
import { Rubik, Secular_One } from "next/font/google";
import { NotificationCenter } from "@/components/notifications/notification-center";
import { ConfirmProvider } from "@/components/ui/confirm";
import "./globals.css";

// הפונטים של מערכת העיצוב: Rubik לגוף, Secular One לכותרות
const rubik = Rubik({
  variable: "--font-rubik",
  subsets: ["hebrew", "latin"],
});

const secularOne = Secular_One({
  variable: "--font-secular",
  weight: "400",
  subsets: ["hebrew", "latin"],
});

const TITLE = "המירוץ למיליון — אימפריית כהן";
const DESCRIPTION =
  "אפליקציית המירוץ המשפחתי השנתי של משפחת כהן — מסורת של 20+ שנה ביום העצמאות";

// כתובת מלאה נדרשת ל-og:image. בוורסל `VERCEL_PROJECT_PRODUCTION_URL` מצביע
// על דומיין הפרודקשן גם מתוך preview — בשונה מ-`VERCEL_URL` שמשתנה לכל דיפלוי,
// והיה גורם לקישור משותף להצביע על דיפלוי חולף
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

// האייקונים ותמונת השיתוף מגיעים מקונבנציית הקבצים של Next
// (`app/icon.png`, `app/apple-icon.png`, `app/opengraph-image.png`)
// ולכן לא מוגדרים כאן — ראו CLAUDE.md §13
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    locale: "he_IL",
    siteName: TITLE,
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: "#0b1b3f", // --navy
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="he"
      dir="rtl"
      className={`${rubik.variable} ${secularOne.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* באנר ההתראות חייב לחיות מעל כל מסך, גם "מהלך המשחק"
            (docs/02 §3.8) — לכן הוא כאן ולא בתוך הצ'אט */}
        {/* דיאלוג האישור עוטף הכל מאותה סיבה שהבאנר עוטף: כל מסך
            מוחק משהו, ו-`window.confirm` מושתק בספארי בנייד
            (components/ui/confirm.tsx) */}
        <ConfirmProvider>
          <NotificationCenter>{children}</NotificationCenter>
        </ConfirmProvider>
      </body>
    </html>
  );
}
