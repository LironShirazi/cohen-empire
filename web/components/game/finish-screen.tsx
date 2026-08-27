"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { WalkerSprite } from "@/components/ui/walking-spinner";
import { Button } from "@/components/ui/button";
import { distanceMeters, formatDistance } from "@/lib/geo";

const noopSubscribe = () => () => {};
const geolocationSupported = () => "geolocation" in navigator;

/**
 * "חזרו לבית סבא וסבתא!" — סקיצה 2g.
 *
 * זה המסך שהקבוצה רואה אחרי התחנה האחרונה, והוא היה עד עכשיו כרטיס
 * לבן עם 🏁. הסקיצה הופכת אותו למסך `.flag` מלא — צהוב, סרט שחור,
 * האמבלם באמצע — כי זה הרגע שבו רצים הביתה, לא מסך סטטוס.
 *
 * ⚠️ **המסך הזה לא מכריע כלום.** מי ניצח נקבע ב-`declare_winner`
 * בשרת (0015); כאן רק שולחים אותם לכיוון הבית. `winner_declared`
 * מגיע מהשרת כבר מסונן לפי מי ששואל — אין לגזור אותו מהסטטוס.
 */
export function FinishScreen({
  announced,
  home,
}: {
  announced: boolean;
  home: { lat: number; lng: number } | null;
}) {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <main className="flag relative flex flex-1 flex-col gap-3.5 overflow-hidden px-5 pt-14 pb-10 text-center">
      {/* הסרט השחור עובר מאחורי האמבלם ויוצא מהמסך משני הצדדים.
          המיקום נגזר מהאמבלם ולא מהסקיצה כלשונה: שם הריפוד העליון
          הוא 76px (סרגל הסטטוס של מסגרת ה-iPhone) והסרט ב-150,
          כלומר בשני שלישים של האמבלם. כאן הריפוד 56, ולכן 130. */}
      <div className="absolute inset-x-[-10px] top-[130px] h-6.5 bg-ink" />

      <Image
        src="/brand/emblem.png"
        alt="סבא וסבתא"
        width={220}
        height={220}
        priority
        className="relative z-2 mx-auto size-[110px] rounded-full border-4 border-ink bg-yellow"
      />

      <p className="font-display text-[42px] leading-[1.05] text-ink">
        חזרו לבית
        <br />
        סבא וסבתא!
      </p>

      <p className="font-semibold text-ink opacity-80">
        סיימתם את כל התחנות 🎉 הראשונים שחוצים את הקו — מנצחים
      </p>

      <HomeDistance home={home} />

      {/* הזוג צועד על כביש כהה — כאן הרקע כבר צהוב, ולכן הרצועה
          שקופה־כהה ולא צהובה כמו בדף הבית */}
      <div className="walker-band-wrap relative mt-auto h-24 overflow-hidden rounded-card bg-black/6">
        <div className="absolute inset-x-0 bottom-0 h-[13px] bg-ink" />
        <WalkerSprite
          height={80}
          className="walker-band absolute bottom-[9px] animate-[walkcycle_0.8s_steps(8)_infinite,cross_7s_linear_infinite]"
        />
      </div>

      {announced ? (
        <Link href="/winners">
          <Button variant="navy" size="lg" className="w-full">
            🏆 למסך הזוכים
          </Button>
        </Link>
      ) : (
        <Button
          variant="navy"
          size="lg"
          className="w-full"
          onClick={() => setNavOpen(true)}
        >
          🗺️ ניווט לבית סבא
        </Button>
      )}

      {navOpen ? (
        <div
          className="absolute inset-0 z-5 flex items-center justify-center bg-ink/55 p-7"
          onClick={() => setNavOpen(false)}
        >
          <div className="flex animate-[reveal-arrive_0.45s_cubic-bezier(.34,1.56,.64,1)_both] flex-col gap-3 rounded-card border border-line bg-surface px-5 py-6 text-center shadow-card">
            <span className="text-[44px]">🤨</span>
            <p className="font-display text-2xl leading-tight">
              מה, אתם לא יודעים את הכתובת?!
            </p>
            <p className="text-small text-muted">
              כל שנה אותו בית. פשוט תתחילו ללכת 😄
            </p>
            <Button onClick={() => setNavOpen(false)}>צודקים, זזנו 🏃</Button>
          </div>
        </div>
      ) : null}
    </main>
  );
}

/**
 * גלולת המרחק הביתה. **תצוגה בלבד** — בשונה מ-`DistanceMeter`, כאן
 * אין מה לבקש מהשרת: אין תחנה לפתוח, רק כיוון כללי לרוץ אליו.
 */
function HomeDistance({ home }: { home: { lat: number; lng: number } | null }) {
  const supported = useSyncExternalStore(
    noopSubscribe,
    geolocationSupported,
    () => true
  );
  const [meters, setMeters] = useState<number | null>(null);

  useWatchPosition(home && supported ? home : null, setMeters);

  if (!home || meters === null) return null;

  return (
    <p className="distpulse self-center rounded-full bg-ink px-5 py-3 text-[22px] font-extrabold text-yellow">
      📍 עוד {formatDistance(meters)} הביתה
    </p>
  );
}

/**
 * ⚠️ ה-watch נסגר ב-cleanup. בלעדיו הוא ממשיך לרוץ אחרי שהמסך נעלם
 * ומרוקן את הסוללה בדיוק כשהקבוצה צריכה אותה כדי להגיע הביתה.
 */
function useWatchPosition(
  home: { lat: number; lng: number } | null,
  onDistance: (meters: number) => void
) {
  useEffect(() => {
    if (!home || !("geolocation" in navigator)) return;

    const id = navigator.geolocation.watchPosition(
      (position) =>
        onDistance(
          distanceMeters(
            position.coords.latitude,
            position.coords.longitude,
            home.lat,
            home.lng
          )
        ),
      () => {},
      { enableHighAccuracy: true, maximumAge: 10000 }
    );

    return () => navigator.geolocation.clearWatch(id);
    // ⚠️ תלות בפרימיטיבים ולא באובייקט `home`. הוא מפוענח מחדש
    // מ-payload של RSC בכל רינדור, ו-`WinnerWatcher` שלצידנו קורא
    // ל-`router.refresh()` כל 20 שניות — כלומר האובייקט מקבל זהות
    // חדשה, האפקט רץ שוב, וה-GPS נסגר ונפתח מחדש עם
    // `enableHighAccuracy` כל 20 שניות. בדיוק ההפך מהכוונה.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [home?.lat, home?.lng, onDistance]);
}
