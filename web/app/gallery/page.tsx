import Link from "next/link";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { NewAlbumForm } from "@/components/gallery/new-album-form";
import { Card } from "@/components/ui/card";
import { PageHeader, PageShell } from "@/components/ui/page";
import { getAlbums, getUser } from "@/lib/data";

export const metadata = {
  title: "📸 גלריה — אימפריית כהן",
};

/**
 * הגלריה המשפחתית (docs/04 §26) — רשימת האלבומים.
 *
 * אלבום ולא שנה: הגלריה היא של המשפחה לכל שימוש, לא רק של המירוץ
 * (מיגרציה 0013). כל בן משפחה פותח אלבום ומוסיף מדיה לכל אלבום.
 *
 * מחוברים בלבד: מדיניות הקריאה היא `to authenticated` מאז 0001.
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
            האלבומים של המשפחה שמורים לבני המשפחה — צריך להתחבר כדי לראות
            אותם ולהוסיף משלכם.
          </p>
          <GoogleSignInButton next="/gallery" />
        </Card>
      </PageShell>
    );
  }

  const albums = await getAlbums();

  return (
    <PageShell>
      <PageHeader title="📸 גלריה" back="/" backLabel="לדף הבית" />

      <NewAlbumForm myUserId={user.id} />

      {albums.length === 0 ? (
        <Card className="mt-6 text-center">
          <p className="text-lg font-bold">עוד אין אלבומים 📭</p>
          <p className="mt-1 text-muted">
            חתונה, טיול, מירוץ — כל אירוע משפחתי יכול לקבל אלבום משלו.
          </p>
        </Card>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-3">
          {albums.map((album) => (
            <Link
              key={album.id}
              href={`/gallery/${album.id}`}
              className="overflow-hidden rounded-card border border-line bg-surface shadow-card"
            >
              <div className="flex aspect-square items-center justify-center bg-bg-2">
                {album.cover_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={album.cover_url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-4xl opacity-40">📷</span>
                )}
              </div>
              <div className="p-3">
                <p className="truncate font-bold">{album.name}</p>
                <p className="text-sm text-muted">
                  {album.count === 1 ? "פריט אחד" : `${album.count} פריטים`}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </PageShell>
  );
}
