import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { loadBoard } from "@/lib/temporal";

export async function GET() {
  const { denied } = await requireUser();
  if (denied) return denied;
  try {
    return NextResponse.json(await loadBoard());
  } catch (err: any) {
    return NextResponse.json({ error: `Temporal did not answer: ${err?.message ?? err}` }, { status: 503 });
  }
}
