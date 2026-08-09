"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMap, Circle, Marker } from "leaflet";
import "leaflet/dist/leaflet.css";

export type MapPoint = { lat: number; lng: number; label?: string };

/**
 * בחירת מיקום התחנה על מפה (Leaflet + OpenStreetMap, docs/02 §1).
 *
 * Leaflet נוגע ב-window, ולכן נטען דינמית בתוך useEffect — כך הרכיב
 * לא נשבר ברינדור בצד השרת בלי לעטוף אותו ב-dynamic ssr:false.
 */
export function StationMap({
  lat,
  lng,
  radiusM,
  others = [],
  onChange,
}: {
  lat: number;
  lng: number;
  radiusM: number;
  others?: MapPoint[];
  onChange?: (lat: number, lng: number) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const marker = useRef<Marker | null>(null);
  const circle = useRef<Circle | null>(null);
  // ה-callback נקרא מתוך event listener של Leaflet שנרשם פעם אחת,
  // ולכן הוא נשמר ב-ref שמתעדכן בכל רינדור
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !container.current || map.current) return;

      const instance = L.map(container.current).setView([lat, lng], 15);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 19,
      }).addTo(instance);

      const pin = L.divIcon({
        html: '<span style="font-size:28px;line-height:1">📍</span>',
        className: "",
        iconSize: [28, 28],
        iconAnchor: [14, 26],
      });

      marker.current = L.marker([lat, lng], {
        icon: pin,
        draggable: Boolean(onChangeRef.current),
      }).addTo(instance);

      circle.current = L.circle([lat, lng], {
        radius: radiusM,
        color: "#E4002B",
        fillColor: "#E4002B",
        fillOpacity: 0.12,
      }).addTo(instance);

      for (const point of others) {
        L.marker([point.lat, point.lng], {
          icon: L.divIcon({
            html: '<span style="font-size:20px;line-height:1;opacity:.55">🏁</span>',
            className: "",
            iconSize: [20, 20],
            iconAnchor: [10, 18],
          }),
        })
          .addTo(instance)
          .bindTooltip(point.label ?? "");
      }

      if (onChangeRef.current) {
        instance.on("click", (event) => {
          const { lat: newLat, lng: newLng } = event.latlng;
          onChangeRef.current?.(newLat, newLng);
        });
        marker.current.on("dragend", () => {
          const position = marker.current!.getLatLng();
          onChangeRef.current?.(position.lat, position.lng);
        });
      }

      map.current = instance;
    })();

    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      marker.current = null;
      circle.current = null;
    };
    // המפה נבנית פעם אחת; מיקום ורדיוס מתעדכנים ב-effect הבא
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    marker.current?.setLatLng([lat, lng]);
    circle.current?.setLatLng([lat, lng]);
    circle.current?.setRadius(radiusM);
  }, [lat, lng, radiusM]);

  return (
    <div
      ref={container}
      className="h-64 w-full overflow-hidden rounded-card border border-line"
      // Leaflet מציירת מעל הכל אם לא מרסנים את ה-z-index
      style={{ zIndex: 0 }}
    />
  );
}
