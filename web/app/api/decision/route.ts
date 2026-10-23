import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { readChore, readNight, sendDecision, temporal } from "@/lib/temporal";

export async function POST(request: Request) {
  const { user, denied } = await requireUser();
  if (denied) return denied;
  const body = await request.json().catch(() => ({}));
  const workflowId = String(body.workflowId ?? "");
  const decision = body.decision;
  if (!/^night-[\w-]+--[\w-]+$/.test(workflowId) || (decision !== "approve" && decision !== "deny")) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  try {
    const c = await temporal();
    // Only the person who started the night may answer for it
    const night = await readNight(c, workflowId.split("--")[0]);
    if (!night) return NextResponse.json({ error: "No such night" }, { status: 404 });
    if (night.userSub && night.userSub !== user.sub) {
      return NextResponse.json({ error: "This run belongs to someone else" }, { status: 403 });
    }
    const state = await readChore(c, workflowId);
    if (!state?.proposal || (state.status !== "waiting" && state.status !== "asking")) {
      return NextResponse.json({ error: "Nothing is waiting for an answer" }, { status: 409 });
    }
    await sendDecision(workflowId, decision);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: `Temporal did not answer: ${err?.message ?? err}` }, { status: 503 });
  }
}
