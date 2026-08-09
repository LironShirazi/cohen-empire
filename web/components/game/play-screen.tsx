"use client";

import Image from "next/image";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { CompleteStation } from "@/components/game/complete-station";
import { DistanceMeter } from "@/components/game/distance-meter";
import { StationReveal } from "@/components/game/station-reveal";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { WalkingSpinner } from "@/components/ui/walking-spinner";
import { isVideoUrl } from "@/lib/media";
import type { CompletionType, GameState } from "@/lib/supabase/types";

const completionNote: Record<CompletionType, string> = {
  admin_approve: "אופן ההשלמה: אישור המנהל התורן",
  secret_code: "אופן ההשלמה: הקוד הסודי שמחכה בתחנה",
  photo_upload: "אופן ההשלמה: צילום והעלאת תמונה",
  auto: "אופן ההשלמה: מספיק להגיע לתחנה",
};

export function PlayScreen({ state }: { state: GameState }) {
  const router = useRouter();
  const { station, team } = state;

  // המנהל עשוי לפתוח משימה ידנית או לאשר אותה מרחוק — בלי הרענון
  // הזה הקבוצה תישאר תקועה על מסך ישן בלי לדעת שהמצב השתנה
  useEffect(() => {
    if (state.state !== "awaiting_approval" && state.state !== "clue") return;
    const timer = setInterval(() => router.refresh(), 12000);
    return () => clearInterval(timer);
  }, [state.state, router]);

  if (state.state === "no_stations") {
    return (
      <Card className="flex flex-col items-center gap-3 text-center">
        <span className="text-5xl">🛠️</span>
        <h2 className="font-display text-xl">המירוץ עוד בהכנות</h2>
        <p className="text-muted">
          המנהל התורן עדיין מסדר את התחנות. תכף מתחילים!
        </p>
      </Card>
    );
  }

  if (state.state === "finished") {
    return (
      <Card className="flex flex-col items-center gap-3 border-ok text-center">
        <span className="text-6xl">🏁</span>
        <h2 className="font-display text-2xl">סיימתם את כל התחנות!</h2>
        <p className="text-lg font-bold">חזרו לבית סבא! 🏠</p>
        <p className="text-muted">נתראה בקו הסיום — שם מכריזים על הזוכים.</p>
      </Card>
    );
  }

  if (!station) return null;

  const teamStrip = (
    <div className="flex items-center gap-2.5">
      <span
        className="flex size-11 flex-none items-center justify-center rounded-2xl text-2xl"
        style={{ background: `color-mix(in srgb, ${team.color} 15%, #fff)` }}
      >
        {team.animal?.split(" ")[0] ?? "🏁"}
      </span>
      <b className="text-xl">{team.name}</b>
    </div>
  );

  if (state.state === "awaiting_approval") {
    return (
      <Card className="flex flex-col items-center gap-3 text-center">
        <Chip tone="yellow">✋ ממתינים לאישור המנהל</Chip>
        <h2 className="font-display text-xl">{station.name}</h2>
        <WalkingSpinner label="המנהל בודק את המשימה…" height={88} />
        <p className="text-sm text-muted">ברגע שיאשר — הרמז הבא ייפתח לבד.</p>
      </Card>
    );
  }

  if (state.state === "clue") {
    return (
      <>
        {/* מעטפת הדגל — סקיצה 1i */}
        <StationReveal
          stationId={station.id}
          position={station.position}
          phase="clue"
          title="תחנה חדשה נפתחה!"
          body={station.clue ?? "אין רמז לתחנה הזו"}
          cta="יצאנו לדרך! 🏃"
        />

        {/* מסך הרמז — סקיצה 1f */}
        <div className="flex flex-col gap-3.5">
          {teamStrip}

          <Card className="flex flex-col gap-3">
            <Chip className="self-start">🔒 בדרך לתחנה {station.position}</Chip>
            <h2 className="font-display text-xl">הרמז</h2>
            <p className="text-[19px] leading-relaxed">
              {station.clue ?? "אין רמז לתחנה הזו"}
            </p>
          </Card>

          <DistanceMeter
            teamId={team.id}
            lat={station.lat}
            lng={station.lng}
            radiusM={station.radius_m}
          />

          <p className="rounded-card-sm border border-line bg-bg-2 px-3.5 py-3 text-center text-sm text-muted">
            המשימה תיחשף רק כשתגיעו פיזית לנקודה 🤫
          </p>
        </div>
      </>
    );
  }

  // state === "task" — הגעתם, המשימה נחשפה (סקיצה 1h)
  return (
    <>
      <StationReveal
        stationId={station.id}
        position={station.position}
        phase="task"
        title="הגעתם!"
        body={station.name ?? "המשימה נפתחה"}
        cta="לפתיחת המשימה 🎯"
      />

      <div className="flex flex-col gap-3.5">
        {/* כותרת הדגל הצהוב עם סמל סבא וסבתא */}
        <div className="flag relative overflow-hidden rounded-card px-5 pt-6 pb-5 text-center">
          <div className="absolute inset-x-[-10px] top-[86px] h-6 bg-ink" />
          <Image
            src="/brand/emblem.png"
            alt="סבא וסבתא — סמל האימפריה"
            width={96}
            height={96}
            className="relative z-[2] mx-auto rounded-full border-4 border-ink bg-yellow"
          />
          <p className="mt-2.5 font-display text-2xl text-ink">
            תחנה {station.position} · {station.name}
          </p>
          <span className="mt-1.5 inline-block rounded-full bg-ink px-4 py-1.5 text-sm font-extrabold text-yellow">
            🎉 הגעתם! המשימה נפתחה
          </span>
        </div>

        <Card className="flex flex-col gap-2.5">
          {station.backstory ? (
            <>
              <h2 className="font-display text-xl">סיפור המקום</h2>
              <p className="leading-relaxed text-muted">{station.backstory}</p>
            </>
          ) : null}

          {/* טקסט ומדיה שניהם רשות, אבל תחנה בלי שום משימה לא צריכה
              כותרת "המשימה" מרחפת מעל כלום */}
          {station.task_content?.text || station.task_content?.media ? (
            <h2 className="mt-1.5 font-display text-xl">המשימה 📸</h2>
          ) : null}

          {station.task_content?.text ? (
            <p className="text-lg leading-relaxed">{station.task_content.text}</p>
          ) : null}

          {/* התמונה/הסרטון של המשימה — מגיעים מהשרת רק אחרי אימות הגעה,
              יחד עם שאר task_content */}
          {station.task_content?.media ? (
            <div className="mt-1 overflow-hidden rounded-card-sm border-2 border-line bg-bg-2">
              {isVideoUrl(station.task_content.media) ? (
                <video
                  src={station.task_content.media}
                  controls
                  playsInline
                  className="w-full"
                />
              ) : (
                // next/image לא מכיר את דומיין ה-Storage, ואת המדיה
                // מעלה המנהל — עדיף img רגיל על פני הגדרת דומיין חיצוני
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={station.task_content.media}
                  alt="מדיה שצורפה למשימה"
                  className="w-full"
                />
              )}
            </div>
          ) : null}
        </Card>

        <p className="rounded-card-sm border border-line bg-bg-2 px-3.5 py-3 text-sm text-muted">
          ✔️ {completionNote[station.completion_type]}
        </p>

        <CompleteStation
          teamId={team.id}
          stationId={station.id}
          completionType={station.completion_type}
        />
      </div>
    </>
  );
}
