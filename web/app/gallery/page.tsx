import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { GalleryScreen } from "@/components/gallery/gallery-screen";
import { Card } from "@/components/ui/card";
import { PageHeader, PageShell } from "@/components/ui/page";
import {
  getGallery,
  getGalleryRaceOptions,
  getMyAdminRaces,
  getProfile,
  getUser,
} from "@/lib/data";

export const metadata = {
  title: "📸 גלריה — אימפריית כהן",
};

/**
 * גלריית התמונות (docs/04 §26) — לפי שנים, החדשה למעלה.
 *
 * מחוברים בלבד: מדיניות הקריאה על `gallery_photos` היא
 * `to authenticated` מאז 0001, כך שלמי שלא מחובר אין כאן מה לראות.
 */
export default async function GalleryPage() {
  const user = await getUser();

  if (!user) {
    return (
      <PageShell className="flex flex-col items-center gap-6 text-center">
        <span className="text-6xl">📸</span>
        <h1 className="font-display text-3xl text-brand">גלריה</h1>
        <Card className="flex flex-col items-center gap-4">
          <p className="text-muted">
            התמונות של כל השנים שמורות למשפחה — צריך להתחבר כדי לראות אותן
            ולהוסיף משלכם.
          </p>
          <GoogleSignInButton next="/gallery" />
        </Card>
      </PageShell>
    );
  }

  const [years, races, profile, adminRaces] = await Promise.all([
    getGallery(),
    getGalleryRaceOptions(),
    getProfile(),
    getMyAdminRaces(),
  ]);

  return (
    <PageShell>
      <PageHeader title="📸 גלריה" back="/" backLabel="לדף הבית" />
      <GalleryScreen
        years={years}
        races={races}
        myUserId={user.id}
        isOwner={!!profile?.is_owner}
        // רק מירוץ שהמשתמש עדיין מנהל: `is_race_admin` בשרת מחזיר false
        // למירוץ בארכיון, ואין טעם להציג כפתור שה-DB ידחה
        adminRaceIds={adminRaces
          .filter((race) => race.status !== "archived")
          .map((race) => race.id)}
      />
    </PageShell>
  );
}
