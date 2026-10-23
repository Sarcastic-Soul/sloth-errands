"use client";
import { useState } from "react";
import { motion } from "motion/react";
import { CheckIcon, XIcon } from "@phosphor-icons/react";
import type { BoardChore, Night } from "@/lib/temporal";
import { clock, heldSince } from "@/lib/view";

type Props = { chore: BoardChore; night: Night | null; onDone?: () => void };

// The approval card, printed like a ticket. Same card on the board and on /approve.
export function Ticket({ chore, night, onDone }: Props) {
  const s = chore.state!;
  const p = s.proposal!;
  const [busy, setBusy] = useState<"approve" | "deny" | null>(null);
  const [answer, setAnswer] = useState<"approve" | "deny" | null>(null);
  const [error, setError] = useState("");
  const since = heldSince(s);

  async function decide(decision: "approve" | "deny") {
    setBusy(decision);
    setError("");
    const res = await fetch("/api/decision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workflowId: chore.workflowId, decision }),
    });
    setBusy(null);
    if (res.status === 401) return void (window.location.href = "/auth/login");
    if (!res.ok) return setError((await res.json().catch(() => ({}))).error ?? "That did not go through. Try again.");
    setAnswer(decision);
    onDone?.();
  }

  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
      className="rounded-[30px] border-[3px] border-ink bg-ink p-2.5"
      aria-label={`Approval needed: ${p.summary}`}
    >
      <div className="overflow-hidden rounded-[21px] bg-bg">
        <div className="flex justify-between gap-3 bg-signal-ink px-[18px] py-3.5 font-mono text-[13px] font-bold leading-none text-bg">
          <span>APPROVAL NEEDED</span>
          <span>{s.status === "asking" ? "Sent to Guardian" : night ? `Asks at ${clock(night.wakeAt)}` : "Waiting"}</span>
        </div>
        <div className="px-[18px] pb-5 pt-5">
          <h3 className="mb-3.5 text-[32px] font-black leading-none tracking-[-0.035em] [text-wrap:balance]">
            {p.summary.replace(/\.$/, "")}?
          </h3>
          <dl className="mb-5 grid grid-cols-2 gap-x-3 gap-y-2.5 border-y-2 border-dashed border-line py-2.5">
            <Field label="Site" value={chore.site} />
            <Field label="Amount" value={p.amount ?? "Not stated"} />
            <Field label="Step" value={p.action} wide />
            <Field label="Held since" value={since ? clock(since) : "--:--"} />
            <Field label="Gives up" value={night ? clock(night.giveUpAt) : "--:--"} />
          </dl>
          {answer ? (
            <p className="flex min-h-[50px] items-center gap-2 border-2 border-ink px-3 font-extrabold">
              {answer === "approve" ? <CheckIcon size={18} aria-hidden /> : <XIcon size={18} aria-hidden />}
              {answer === "approve" ? "Approved. Doing it now." : "Denied. Nothing will be done."}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={!!busy}
                onClick={() => decide("deny")}
                className="flex min-h-[50px] cursor-pointer items-center justify-center gap-2 border-2 border-ink font-extrabold transition-colors hover:bg-bg-2 active:translate-y-px disabled:cursor-wait disabled:opacity-60"
              >
                <XIcon size={18} aria-hidden />
                {busy === "deny" ? "Sending" : "Deny"}
              </button>
              <button
                type="button"
                disabled={!!busy}
                onClick={() => decide("approve")}
                className="flex min-h-[50px] cursor-pointer items-center justify-center gap-2 border-2 border-ink bg-ink font-extrabold text-bg transition-colors hover:bg-[#33353a] active:translate-y-px disabled:cursor-wait disabled:opacity-60"
              >
                <CheckIcon size={18} aria-hidden />
                {busy === "approve" ? "Sending" : "Approve"}
              </button>
            </div>
          )}
          {error && <p role="alert" className="mt-3 text-sm font-bold text-signal-ink">{error}</p>}
          <p className="mt-3.5 font-mono text-xs leading-snug text-ink-2">
            {night?.demo ? "Missed it? It asks again in 1 minute." : "Missed it? It asks again in 15 minutes."}
          </p>
        </div>
      </div>
    </motion.article>
  );
}

function Field({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? "col-span-2" : undefined}>
      <dt className="mb-1 font-mono text-[11px] leading-none text-ink-2">{label}</dt>
      <dd className="text-base font-extrabold leading-tight">{value}</dd>
    </div>
  );
}
