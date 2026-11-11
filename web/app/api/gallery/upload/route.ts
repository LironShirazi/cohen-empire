import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { STORAGE_MAX_BYTES } from "@/lib/media";
import { deleteObject, isR2Configured, presignUpload, publicUrl } from "@/lib/r2";

// העלאה לגלריה עוברת ב-R2 (מיגרציה 0022). ל-R2 אין RLS, ולכן מה
// שה-Storage של Supabase אכף לבד נאכף כאן: משתמש מחובר, אלבום קיים,
// ותקרת 50MB — שנכנסת לחתימה ולכן נאכפת ב-R2 עצמו ולא רק כאן.
//
// בלי מפתחות R2 התשובה היא `supabase`, והקליינט מעלה כמו קודם.

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const PATH = new RegExp(`^${UUID}/${UUID}\\.[a-z0-9]{1,5}$`);

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "צריך להתחבר" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const { albumId, extension, contentType, size } = body ?? {};

  if (typeof albumId !== "string" || !new RegExp(`^${UUID}$`).test(albumId)) {
    return NextResponse.json({ error: "אלבום לא תקין" }, { status: 400 });
  }
  if (typeof extension !== "string" || !/^[a-z0-9]{1,5}$/.test(extension)) {
    return NextResponse.json({ error: "סוג קובץ לא נתמך" }, { status: 400 });
  }
  if (typeof size !== "number" || !Number.isInteger(size) || size <= 0) {
    return NextResponse.json({ error: "קובץ ריק" }, { status: 400 });
  }
  if (size > STORAGE_MAX_BYTES) {
    return NextResponse.json({ error: "הקובץ גדול מדי" }, { status: 413 });
  }
  const type =
    typeof contentType === "string" && /^[\w.+-]+\/[\w.+-]+$/.test(contentType)
      ? contentType
      : "application/octet-stream";

  const { data: album } = await supabase
    .from("gallery_albums")
    .select("id")
    .eq("id", albumId)
    .maybeSingle();
  if (!album) {
    return NextResponse.json({ error: "האלבום לא נמצא" }, { status: 404 });
  }

  const path = `${albumId}/${randomUUID()}.${extension}`;
  if (!isR2Configured) return NextResponse.json({ provider: "supabase", path });

  return NextResponse.json({
    provider: "r2",
    path,
    contentType: type,
    uploadUrl: presignUpload(path, size, type),
    publicUrl: publicUrl(path),
  });
}

/**
 * מחיקת קובץ מ-R2 — **רק אחרי שהשורה שלו נמחקה** (אותו סדר כמו §10:
 * קודם השורה, אחר-כך הקובץ). ההרשאה למחוק נבדקה כבר על השורה ב-RLS
 * (`gallery_delete`), ולכן כאן מספיק לוודא שאף שורה כבר לא מצביעה על
 * הקובץ: מותר למחוק רק קובץ יתום. אותו נתיב משמש לניקוי העלאה שהשורה
 * שלה נכשלה.
 */
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "צריך להתחבר" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const path = body?.path;
  if (typeof path !== "string" || !PATH.test(path)) {
    return NextResponse.json({ error: "נתיב לא תקין" }, { status: 400 });
  }
  if (!isR2Configured) return new NextResponse(null, { status: 204 });

  // `gallery_read` (0001) פתוח לכל מחובר, אז הבדיקה רואה את כל השורות
  const { count, error } = await supabase
    .from("gallery_photos")
    .select("id", { count: "exact", head: true })
    .eq("storage_provider", "r2")
    .eq("storage_path", path);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (count) {
    return NextResponse.json({ error: "הקובץ עדיין בשימוש" }, { status: 409 });
  }

  await deleteObject(path);
  return new NextResponse(null, { status: 204 });
}
