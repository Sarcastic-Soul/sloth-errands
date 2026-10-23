"use client";
import { useCallback, useEffect, useState } from "react";
import { CheckIcon, XIcon } from "@phosphor-icons/react";
import type { BoardChore, Night } from "@/lib/temporal";
import { describeRow, isHeld } from "@/lib/view";
import { Ticket } from "./ticket";

type Found = { night: Night; chore: BoardChore };

// Phone page for one held chore. Keeps polling so it shows what happened after you answer.
export function ApproveView({ initial }: { initial: Found }) {
  const [found, setFound] = useState(initial);
  const refresh = useCallback(async () => {
    const res = await fetch(`/api/chore/${encodeURIComponent(initial.chore.workflowId)}`, { cache: "no-store" }).catch(() => null);
    if (res?.status === 401) return void (window.location.href = "/auth/login");
    if (res?.ok) setFound(await res.json());
  }, [initial.chore.workflowId]);

  useEffect(() => {
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, [refresh]);

  const { night, chore } = found;
  if (isHeld(chore.state)) return <Ticket chore={chore} night={night} onDone={refresh} />;

  const row = describeRow(chore, night);
  const ok = chore.state?.status === "done";
  return (
    <article className="border-[3px] border-ink">
      <div className={`px-4 py-3.5 font-mono text-[13px] font-bold leading-none text-bg ${ok ? "bg-ink" : "bg-signal-ink"}`}>
        {row.label.toUpperCase()}
      </div>
      <div className="p-4">
        <h1 className="mb-3 text-[32px] font-black leading-none tracking-[-0.035em]">{chore.title}</h1>
        <p className="flex items-start gap-2 leading-snug">
          {ok ? <CheckIcon size={20} aria-hidden className="mt-0.5 shrink-0" /> : <XIcon size={20} aria-hidden className="mt-0.5 shrink-0" />}
          {row.note || "No answer is needed for this chore."}
        </p>
        <a href="/" className="mt-5 inline-block font-bold underline underline-offset-4">
          See the whole board
        </a>
      </div>
    </article>
  );
}
