import "server-only";
import { NextResponse } from "next/server";
import { auth0 } from "./auth0";

// Route handlers check the session themselves too, not only the proxy
export async function requireUser() {
  const session = await auth0.getSession();
  if (!session) return { user: null, denied: NextResponse.json({ error: "Sign in first" }, { status: 401 }) } as const;
  return { user: session.user, denied: null } as const;
}
