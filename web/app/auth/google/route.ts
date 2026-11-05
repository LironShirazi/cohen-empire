import { createHash, randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// התחברות עם Google בלי לעבור דרך <project-ref>.supabase.co: Google מציג
// במסך ההסכמה את הדומיין של כתובת החזרה, ולכן החזרה היא לכאן. Google שולח
// id_token ב-POST (form_post), והוא מוחלף לסשן ב-signInWithIdToken — Supabase
// מאמת חתימה, audience ו-nonce בעצמו.

const COOKIE = "google-signin";

function safeNext(requested: string | null) {
  // רק נתיב פנימי — "//evil.com" הוא URL חיצוני תקין ויוצר open redirect
  const next = requested ?? "/";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export async function GET(request: NextRequest) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const { origin, searchParams } = request.nextUrl;
  if (!clientId) return NextResponse.redirect(`${origin}/auth/error`);

  const state = randomBytes(16).toString("hex");
  const nonce = randomBytes(16).toString("hex");

  const google = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  google.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${origin}/auth/google`,
    response_type: "id_token",
    response_mode: "form_post",
    scope: "openid email profile",
    // ל-Google הולך ה-hash, ל-Supabase הערך הגולמי — הוא משווה בעצמו
    nonce: createHash("sha256").update(nonce).digest("hex"),
    state,
    prompt: "select_account",
  }).toString();

  const response = NextResponse.redirect(google);
  // ה-POST מגיע מ-accounts.google.com, כלומר cross-site: עם SameSite=Lax
  // הדפדפן לא היה מצרף את העוגייה, ובלעדיה אין דרך לאמת את ה-state
  response.cookies.set(
    COOKIE,
    JSON.stringify({ state, nonce, next: safeNext(searchParams.get("next")) }),
    {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/auth/google",
      maxAge: 600,
    }
  );
  return response;
}

export async function POST(request: NextRequest) {
  const { origin } = request.nextUrl;
  const saved = parseCookie(request.cookies.get(COOKIE)?.value);
  // POST שאינו טופס (לא מ-Google) — formData() זורק, ובלי זה זה 500
  const form = await request.formData().catch(() => null);

  // 303 ולא ברירת המחדל 307 — אחרת הדפדפן שולח POST גם לעמוד היעד
  const redirect = (path: string) => {
    const response = NextResponse.redirect(`${origin}${path}`, 303);
    response.cookies.delete({ name: COOKIE, path: "/auth/google" });
    return response;
  };

  if (!form || !saved || form.get("state") !== saved.state) {
    return redirect("/auth/error");
  }
  // המשתמש סגר את חלון הבחירה — חוזרים בשקט למקום שממנו יצא
  if (form.get("error")) return redirect(saved.next);

  const token = form.get("id_token");
  if (typeof token !== "string") return redirect("/auth/error");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithIdToken({
    provider: "google",
    token,
    nonce: saved.nonce,
  });
  return redirect(error ? "/auth/error" : saved.next);
}

function parseCookie(value: string | undefined) {
  if (!value) return null;
  try {
    const { state, nonce, next } = JSON.parse(value);
    if (typeof state !== "string" || typeof nonce !== "string") return null;
    return { state, nonce, next: safeNext(next) };
  } catch {
    return null;
  }
}
