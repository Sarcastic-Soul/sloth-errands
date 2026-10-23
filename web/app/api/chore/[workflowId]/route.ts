import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { loadChore } from "@/lib/temporal";

export async function GET(_req: Request, ctx: RouteContext<"/api/chore/[workflowId]">) {
  const { user, denied } = await requireUser();
  if (denied) return denied;
  const { workflowId } = await ctx.params;
  try {
    const found = await loadChore(workflowId);
    if (!found) return NextResponse.json({ error: "No such chore" }, { status: 404 });
    if (found.night.userSub && found.night.userSub !== user.sub) {
      return NextResponse.json({ error: "This run belongs to someone else" }, { status: 403 });
    }
    return NextResponse.json(found);
  } catch (err: any) {
    return NextResponse.json({ error: `Temporal did not answer: ${err?.message ?? err}` }, { status: 503 });
  }
}
