"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import { arriveAction } from "@/app/team/actions";
import { Button } from "@/components/ui/button";
import { allowedRadius, distanceMeters, formatDistance } from "@/lib/geo";

type Fix = { lat: number; lng: number; accuracy: number | null };

// תמיכת הדפדפן היא נתון חיצוני שלא משתנה — נקרא דרך useSyncExternalStore
// כדי שלא נצטרך setState בתוך effect. בשרת מניחים "נתמך", אחרת כל
// טעינה מהבהבת בהודעת שגיאה לפני ההידרציה.
const noopSubscribe = () => () => {};
const geolocationSupported = () => "geolocation" in navigator;

/**
 * מד המרחק החי + הבקשה לפתיחת המשימה.
 *
 * ה-watchPosition כאן משמש לשני דברים: להראות "עוד 340 מ׳", ולדעת
 * מתי בכלל שווה לשאול את השרת. ההחלטה אם הגעתם היא של השרת בלבד
 * (docs/02-architecture.md §3.1) — מכאן אי אפשר לפתוח משימה.
 */
export function DistanceMeter({
  teamId,
  lat,
  lng,
  radiusM,
}: {
  teamId: string;
  lat: number;
  lng: number;
  radiusM: number;
}) {
  const [fix, setFix] = useState<Fix | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [tooFar, setTooFar] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const asked = useRef(false);
  const supported = useSyncExternalStore(
    noopSubscribe,
    geolocationSupported,
    () => true
  );

  useEffect(() => {
    if (!supported) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setGeoError(null);
        setFix({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy ?? null,
        });
      },
      (error) => {
        setGeoError(
          error.code === error.PERMISSION_DENIED
            ? "אין הרשאת מיקום — צריך לאשר איתור מיקום כדי שהמשימה תיפתח"
            : "לא מצליחים לאתר את המיקום כרגע"
        );
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [supported]);

  const message = supported
    ? geoError
    : "הדפדפן לא תומך באיתור מיקום — בקשו מהמנהל לפתוח את המשימה ידנית";

  const distance = fix ? distanceMeters(fix.lat, fix.lng, lat, lng) : null;
  const inRange =
    distance !== null && distance <= allowedRadius(radiusM, fix?.accuracy ?? null);

  function checkArrival(current: Fix) {
    startTransition(async () => {
      const result = await arriveAction(
        teamId,
        current.lat,
        current.lng,
        current.accuracy
      );
      // המסך מתרענן לבד כשהשרת מאשר; אחרת מראים כמה חסר
      if (!result.arrived) {
        setTooFar(result.distance_m);
        asked.current = false;
      }
    });
  }

  // נכנסנו לרדיוס — שואלים את השרת פעם אחת, לא על כל דגימה
  useEffect(() => {
    if (!fix || !inRange || asked.current) return;
    asked.current = true;
    checkArrival(fix);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fix, inRange]);

  return (
    <div className="flex flex-col gap-3">
      <div className="distpulse rounded-full bg-ink px-4 py-3 text-center text-[22px] font-extrabold text-white">
        {distance === null
          ? "📍 מאתרים אתכם…"
          : `📍 עוד ${formatDistance(distance)} ${distance < 300 ? "🔥" : ""}`}
      </div>

      {message ? (
        <p className="rounded-card-sm bg-yellow-soft px-3.5 py-2.5 text-sm font-bold">
          {message}
        </p>
      ) : null}

      {tooFar !== null && !inRange ? (
        <p className="text-center text-sm text-muted">
          עוד לא הגעתם — השרת מדד {formatDistance(tooFar)} מהתחנה
        </p>
      ) : null}

      <Button
        variant="secondary"
        onClick={() => fix && checkArrival(fix)}
        disabled={!fix || pending}
      >
        {pending ? "בודקים…" : "הגענו! בדקו אותנו 📍"}
      </Button>

      <p className="text-center text-xs text-muted">
        תקועים בגלל קליטה? המנהל התורן יכול לפתוח לכם את המשימה ידנית.
      </p>
    </div>
  );
}
