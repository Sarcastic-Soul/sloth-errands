import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { catalog, startNight } from "@/lib/temporal";

export async function POST(request: Request) {
  const { user, denied } = await requireUser();
  if (denied) return denied;
  const body = await request.json().catch(() => ({}));
  const choreIds = Array.isArray(body.choreIds)
    ? body.choreIds.filter((id: unknown) => catalog.some((c) => c.id === id))
    : [];
  const wakeIn = Number(body.wakeInMin);
  if (!choreIds.length) return NextResponse.json({ error: "Pick at least one chore" }, { status: 400 });
  if (!Number.isFinite(wakeIn) || wakeIn < 0 || wakeIn > 720) {
    return NextResponse.json({ error: "Wake-up must be 0 to 720 minutes away" }, { status: 400 });
  }
  try {
    const id = await startNight({
      choreIds,
      wakeAt: Date.now() + wakeIn * 60_000,
      userSub: user.sub,
      demo: !!body.demo,
    });
    return NextResponse.json({ id });
  } catch (err: any) {
    return NextResponse.json({ error: `Could not start the run: ${err?.message ?? err}` }, { status: 503 });
  }
}
