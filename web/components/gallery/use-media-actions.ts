"use client";

import { useState } from "react";
import type { GalleryPhotoRow } from "@/lib/data";
import {
  downloadFiles,
  fetchPhotoFiles,
  shareFilesNow,
  type ShareResult,
} from "@/lib/gallery-actions";

/**
 * הורדה ושיתוף — אותה התנהגות בתצוגה המוגדלת ובבחירה המרובה.
 *
 * `pendingShare` הוא המצב שבו הקבצים כבר נמשכו אבל ספארי איבד את
 * הלחיצה בדרך (ראו `shareFilesNow`): המסך מציג כפתור "לשיתוף" שני,
 * ולחיצה עליו קוראת ל-`sharePending` בלי שום המתנה לפני `navigator.share`.
 */
export function useMediaActions(
  albumName: string,
  allPhotos: GalleryPhotoRow[]
) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingShare, setPendingShare] = useState<{
    files: File[];
    photos: GalleryPhotoRow[];
  } | null>(null);

  async function load(photos: GalleryPhotoRow[], verb: string) {
    setError(null);
    setNotice(null);
    setPendingShare(null);
    setBusy(photos.length > 1 ? `${verb} 0/${photos.length}...` : `${verb}...`);
    return fetchPhotoFiles(photos, albumName, allPhotos, (done) => {
      if (photos.length > 1) setBusy(`${verb} ${done}/${photos.length}...`);
    });
  }

  function report(result: ShareResult, files: File[], photos: GalleryPhotoRow[]) {
    if (result === "needs-tap") setPendingShare({ files, photos });
    if (result === "copied") setNotice("הקישורים הועתקו — אפשר להדביק בוואטסאפ");
  }

  async function download(photos: GalleryPhotoRow[]) {
    if (photos.length === 0) return false;
    try {
      const files = await load(photos, "מוריד");
      await downloadFiles(files);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "ההורדה נכשלה — ננסה שוב?");
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function share(photos: GalleryPhotoRow[]) {
    if (photos.length === 0) return false;
    try {
      const files = await load(photos, "מכין");
      setBusy(null);
      const result = await shareFilesNow(files, photos);
      report(result, files, photos);
      return result === "shared";
    } catch (err) {
      setError(err instanceof Error ? err.message : "השיתוף נכשל — ננסה שוב?");
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function sharePending() {
    if (!pendingShare) return false;
    const { files, photos } = pendingShare;
    setPendingShare(null);
    try {
      const result = await shareFilesNow(files, photos);
      report(result, files, photos);
      return result === "shared";
    } catch (err) {
      setError(err instanceof Error ? err.message : "השיתוף נכשל — ננסה שוב?");
      return false;
    }
  }

  return {
    busy,
    error,
    notice,
    pendingShare: !!pendingShare,
    download,
    share,
    sharePending,
    setError,
  };
}
