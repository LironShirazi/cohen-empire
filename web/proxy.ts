import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  isSupabaseConfigured,
  supabaseAnonKey,
  supabaseUrl,
} from "@/lib/supabase/env";

// ב-Next 16 קובץ ה-middleware נקרא proxy.ts; תפקידו כאן: רענון סשן Supabase
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  if (!isSupabaseConfigured) return response;

  const supabase = createServerClient(supabaseUrl!, supabaseAnonKey!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // אסור להסיר: מרענן טוקן שפג, אחרת משתמשים ינותקו אקראית.
  // `getClaims` ולא `getUser`: הוא מרענן באותה מידה, אבל מאמת את ה-JWT
  // מקומית מול מפתחות ה-JWKS (כשהפרויקט על מפתחות אסימטריים) — בלי סבב
  // רשת לשרת ה-Auth על כל ניווט ועל כל prefetch. על מפתח HS256 ישן הוא
  // חוזר בעצמו ל-getUser, כך שבמקרה הגרוע זה בדיוק מה שהיה.
  await supabase.auth.getClaims();

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
