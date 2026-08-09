import { notFound, redirect } from "next/navigation";
import { StationEditor } from "@/components/admin/station-editor";
import { StationMap } from "@/components/admin/station-map";
import { StationOrder } from "@/components/admin/station-order";
import { Card } from "@/components/ui/card";
import { PageHeader, PageShell } from "@/components/ui/page";
import {
  getRace,
  getRaceStations,
  getTeamStationOrders,
  getUser,
  isRaceAdmin,
} from "@/lib/data";

// ברירת מחדל למרכז המפה כשעוד אין נקודת זינוק: אזור נתיבות/שדות נגב
const DEFAULT_CENTER = { lat: 31.4222, lng: 34.5895 };

export default async function AdminStationsPage(
  props: PageProps<"/admin/[raceId]/stations">
) {
  const user = await getUser();
  if (!user) redirect("/");

  const { raceId } = await props.params;
  if (!(await isRaceAdmin(raceId))) notFound();

  const race = await getRace(raceId);
  if (!race) notFound();

  const [stations, orders] = await Promise.all([
    getRaceStations(raceId),
    getTeamStationOrders(raceId),
  ]);

  const center =
    race.start_lat != null && race.start_lng != null
      ? { lat: race.start_lat, lng: race.start_lng }
      : DEFAULT_CENTER;

  const points = stations.map((station) => ({
    lat: station.lat,
    lng: station.lng,
    label: station.name,
  }));

  return (
    <PageShell className="flex flex-col gap-4">
      <PageHeader
        title="📍 תחנות"
        back={`/admin/${raceId}`}
        backLabel="ללוח הבקרה"
      />

      {stations.length === 0 ? (
        <Card className="text-center text-muted">
          עוד אין תחנות. מוסיפים את הראשונה למטה 👇
        </Card>
      ) : (
        // מפה של כל התחנות יחד (docs/04-screens-ux.md §4) — קל לראות
        // אם תחנה נפלה רחוק מדי או שתיים יושבות אחת על השנייה
        <Card className="flex flex-col gap-2">
          <h2 className="font-display text-xl">כל התחנות על המפה</h2>
          <StationMap
            lat={stations[0].lat}
            lng={stations[0].lng}
            radiusM={stations[0].radius_m}
            others={points.slice(1)}
          />
        </Card>
      )}

      {stations.map((station) => (
        <details key={station.id} className="rounded-card">
          <summary className="cursor-pointer rounded-card border border-line bg-surface p-4 font-bold shadow-card">
            {station.name}
            <span className="ms-2 text-sm font-normal text-muted">
              רדיוס {station.radius_m} מ׳
            </span>
          </summary>
          <div className="mt-2">
            <StationEditor
              raceId={raceId}
              station={station}
              others={points.filter((point) => point.label !== station.name)}
              fallbackCenter={center}
            />
          </div>
        </details>
      ))}

      <StationOrder
        raceId={raceId}
        orders={orders}
        locked={race.status === "live" || race.status === "finished" || race.status === "archived"}
      />

      <h2 className="font-display text-xl">תחנה חדשה</h2>
      <StationEditor raceId={raceId} others={points} fallbackCenter={center} />
    </PageShell>
  );
}
