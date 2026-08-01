import type { Metadata, Viewport } from "next";
import { Heebo } from "next/font/google";
import "./globals.css";

const heebo = Heebo({
  variable: "--font-heebo",
  subsets: ["hebrew", "latin"],
});

export const metadata: Metadata = {
  title: "המירוץ למיליון — אימפריית כהן",
  description:
    "אפליקציית המירוץ המשפחתי השנתי של משפחת כהן — מסורת של 20+ שנה ביום העצמאות",
};

export const viewport: Viewport = {
  themeColor: "#1e2a4a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl" className={`${heebo.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
