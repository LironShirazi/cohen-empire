import type { Metadata, Viewport } from "next";
import { Rubik, Secular_One } from "next/font/google";
import { NotificationCenter } from "@/components/notifications/notification-center";
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

export const metadata: Metadata = {
  title: "המירוץ למיליון — אימפריית כהן",
  description:
    "אפליקציית המירוץ המשפחתי השנתי של משפחת כהן — מסורת של 20+ שנה ביום העצמאות",
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
        <NotificationCenter>{children}</NotificationCenter>
      </body>
    </html>
  );
}
