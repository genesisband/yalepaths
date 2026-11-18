import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isYaleEmail } from "@/lib/domain";

const PROTECTED = ["/explore", "/onboarding", "/experience", "/profile", "/members", "/messages"];

function isProtected(pathname: string) {
  return PROTECTED.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const redirectTo = (pathname: string) => {
    const redirected = NextResponse.redirect(new URL(pathname, request.url));
    response.cookies.getAll().forEach((cookie) => redirected.cookies.set(cookie));
    return redirected;
  };

  const { data } = await supabase.auth.getUser();
  const user = data.user;
  const path = request.nextUrl.pathname;

  if (!user) {
    if (isProtected(path)) return redirectTo("/");
    return response;
  }

  if (!isYaleEmail(user.email)) {
    await supabase.auth.signOut();
    return redirectTo("/?error=domain");
  }

  const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle();
  const ready = Boolean(profile?.display_name && profile.display_name.trim());

  if (!ready && isProtected(path) && path !== "/onboarding") return redirectTo("/onboarding");
  if (ready && (path === "/" || path === "/onboarding")) return redirectTo("/explore");
  return response;
}
