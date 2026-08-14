"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, LayerGroup } from "leaflet";
import "leaflet/dist/leaflet.css";
import type { TeamOnMap } from "@/lib/data";
import type { Station } from "@/lib/supabase/types";

// ה-default של leaflet הוא ה-namespace עצמו (ראו StationMap); בטיפוסים
// אין default סינתטי, ולכן מציינים את ה-namespace ישירות
type Leaflet = typeof import("leaflet");

/** מעל זה המיקום כבר לא "עכשיו" — מסמנים אותו דהוי במקום לשקר */
const STALE_MS = 10 * 60 * 1000;

/**
 * מפת המנהל החיה (docs/01 §4, docs/04 §4) — איפה כל קבוצה נמצאת
 * ממש עכשיו, על רקע התחנות של המירוץ.
 *
 * **למנהל בלבד.** ה-RLS ב-0008 לא מחזיר שורות למשתתף, וגם המסך הזה
 * חי רק תחת `/admin`. משתתף שיראה איפה כולם — הורג את המתח שהלידרבורד
 * נבנה במיוחד כדי לשמור (docs/02 §3.3).
 *
 * כמו ב-StationMap, Leaflet נטענת דינמית בתוך useEffect כי היא נוגעת
 * ב-window. הנתונים מגיעים מרינדור השרת ומתרעננים עם כל הרענון
 * התקופתי של המסך (LivePanel, כל 8 שניות).
 */
export function LiveMap({
  teams,
  stations,
}: {
  teams: TeamOnMap[];
  stations: Station[];
}) {
  // הטעינה של Leaflet היא אסינכרונית, ולכן "המפה מוכנה" חייב להיות
  // state ולא ref: אחרת האפקטים שמציירים ירוצו פעם אחת על מפה שעוד
  // לא קיימת, ולא ירוצו שוב עד שהנתונים ישתנו
  const [ready, setReady] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const teamLayer = useRef<LayerGroup | null>(null);
  const leaflet = useRef<Leaflet | null>(null);
  // ממרכזים פעם אחת בלבד — אחרת כל רענון היה קופץ למנהל את המפה
  // מתחת לאצבע בזמן שהוא מסתכל על פינה מסוימת
  const fitted = useRef(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !container.current || map.current) return;

      const instance = L.map(container.current).setView([32.0853, 34.7818], 12);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 19,
      }).addTo(instance);

      leaflet.current = L;
      teamLayer.current = L.layerGroup().addTo(instance);
      map.current = instance;
      setReady(true);
    })();

    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      teamLayer.current = null;
      leaflet.current = null;
      setReady(false);
    };
  }, []);

  // התחנות קבועות במהלך המירוץ, ולכן נצבעות בשכבה נפרדת שלא מצוירת
  // מחדש עם כל דגימת מיקום
  useEffect(() => {
    const L = leaflet.current;
    const instance = map.current;
    if (!L || !instance) return;

    const layer = L.layerGroup().addTo(instance);
    for (const station of stations) {
      L.marker([station.lat, station.lng], {
        icon: L.divIcon({
          html: '<span style="font-size:20px;line-height:1;opacity:.6">🏁</span>',
          className: "",
          iconSize: [20, 20],
          iconAnchor: [10, 18],
        }),
      })
        .addTo(layer)
        .bindTooltip(station.name);

      L.circle([station.lat, station.lng], {
        radius: station.radius_m,
        color: "#7a6a55",
        weight: 1,
        fillOpacity: 0.06,
      }).addTo(layer);
    }

    return () => {
      layer.remove();
    };
  }, [stations, ready]);

  useEffect(() => {
    const L = leaflet.current;
    const instance = map.current;
    const layer = teamLayer.current;
    if (!L || !instance || !layer) return;

    layer.clearLayers();

    const now = Date.now();
    for (const row of teams) {
      const age = now - new Date(row.location.updated_at).getTime();
      const emoji = row.team.animal?.split(" ")[0] ?? "🏃";

      L.marker([row.location.lat, row.location.lng], {
        icon: L.divIcon({
          className: "",
          iconSize: [34, 34],
          iconAnchor: [17, 17],
          html: `<span style="display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:50%;background:${row.team.color};border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35);font-size:17px;opacity:${age > STALE_MS ? 0.45 : 1}">${emoji}</span>`,
        }),
      })
        .addTo(layer)
        .bindTooltip(`${row.team.name} · ${describeAge(age)}`);
    }

    // ממקדים על קבוצות ותחנות יחד, כדי שקבוצה אחת שתעתה רחוק לא
    // תוציא את כל השאר מהמסך
    if (fitted.current) return;
    const points: [number, number][] = [
      ...teams.map(
        (row) => [row.location.lat, row.location.lng] as [number, number]
      ),
      ...stations.map(
        (station) => [station.lat, station.lng] as [number, number]
      ),
    ];
    if (points.length > 0) {
      fitted.current = true;
      instance.fitBounds(L.latLngBounds(points).pad(0.2));
    }
  }, [teams, stations, ready]);

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={container}
        className="h-72 w-full overflow-hidden rounded-card border border-line"
        // Leaflet מציירת מעל הכל אם לא מרסנים את ה-z-index
        style={{ zIndex: 0 }}
      />
      {teams.length === 0 ? (
        <p className="text-sm text-muted">
          עוד לא התקבל מיקום מאף קבוצה. המיקום מדווח ממסך &quot;מהלך
          המשחק&quot; של המשתתפים, אחרי שהם מאשרים גישה למיקום בטלפון.
        </p>
      ) : null}
    </div>
  );
}

function describeAge(ms: number): string {
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) return "עכשיו";
  if (minutes < 60) return `לפני ${minutes} דק׳`;
  return `לפני ${Math.round(minutes / 60)} שע׳`;
}
