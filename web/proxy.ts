import { NextResponse, type NextRequest } from "next/server";
import { auth0 } from "./lib/auth0";

// Every page needs a signed-in user. The home page shows its own sign-in screen instead.
export async function proxy(request: NextRequest) {
  const authRes = await auth0.middleware(request);
  const url = new URL(request.url);
  if (url.pathname.startsWith("/auth") || url.pathname === "/") return authRes;

  const session = await auth0.getSession(request);
  if (session) return authRes;
  if (url.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  }
  const login = new URL("/auth/login", url.origin);
  login.searchParams.set("returnTo", url.pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)"],
};
