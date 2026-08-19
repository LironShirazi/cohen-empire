import { notFound, redirect } from "next/navigation";
import { AlbumScreen } from "@/components/gallery/album-screen";
import { PageHeader, PageShell } from "@/components/ui/page";
import { getAlbum, getAlbumPhotos, getProfile, getUser } from "@/lib/data";

/** אלבום בגלריה המשפחתית (מיגרציה 0013) */
export default async function AlbumPage(
  props: PageProps<"/gallery/[albumId]">
) {
  const user = await getUser();
  if (!user) redirect("/gallery");

  const { albumId } = await props.params;
  const album = await getAlbum(albumId);
  if (!album) notFound();

  const [photos, profile] = await Promise.all([
    getAlbumPhotos(albumId),
    getProfile(),
  ]);

  return (
    <PageShell>
      <PageHeader title="📸 גלריה" back="/gallery" backLabel="לכל האלבומים" />
      <AlbumScreen
        album={album}
        photos={photos}
        myUserId={user.id}
        isOwner={!!profile?.is_owner}
      />
    </PageShell>
  );
}
