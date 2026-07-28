import type { Metadata, Viewport } from "next";
import { Heebo } from "next/font/google";
import "./globals.css";

const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  variable: "--font-heebo",
});

export const metadata: Metadata = {
  title: "המירוץ למיליון — אימפריית כהן",
  description:
    "המירוץ המשפחתי השנתי של משפחת כהן — מסורת של יותר מ-20 שנה, כל יום העצמאות",
};

export const viewport: Viewport = {
  themeColor: "#c2410c",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl" className={`${heebo.variable} h-full`}>
      <body className="min-h-dvh bg-cream font-sans text-ink antialiased">
        {children}
      </body>
    </html>
  );
}
