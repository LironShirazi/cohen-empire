import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // ה-Service Worker (התראות Push, CLAUDE.md §23) לא נשמר בקאש:
        // דפדפנים בודקים אותו מחדש לפחות כל 24 שעות, אבל קאש HTTP היה
        // מעכב תיקון ב-sw.js ליום. ה-CSP מונע ממנו לטעון קוד מבחוץ.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
