"use client";
import { useCallback, useEffect, useState } from "react";
import { motion } from "motion/react";
import {
  ArrowClockwiseIcon,
  CheckIcon,
  ClockIcon,
  HandIcon,
  HourglassIcon,
  PlugsIcon,
  WarningIcon,
  type Icon,
} from "@phosphor-icons/react";
import type { Board } from "@/lib/temporal";
import { announcements, clock, describeRow, isHeld, type Tone } from "@/lib/view";
import { Ticket } from "./ticket";
import { StartRun } from "./start-run";

const icons: Record<Tone, Icon> = {
  done: CheckIcon,
  held: HandIcon,
  delay: ArrowClockwiseIcon,
  wait: HourglassIcon,
  run: ClockIcon,
  fail: WarningIcon,
  off: PlugsIcon,
};

const statusColor: Record<Tone, string> = {
  done: "text-ink",
  held: "text-signal-ink",
  delay: "text-ink",
  wait: "text-ink-2",
  run: "text-ink-2",
  fail: "text-signal-ink",
  off: "text-ink-2",
};

export function BoardView({ initial, initialError }: { initial: Board | null; initialError?: string }) {
  const [board, setBoard] = useState(initial);
  const [error, setError] = useState(initialError ?? "");

  const refresh = useCallback(async () => {
    const res = await fetch("/api/board", { cache: "no-store" }).catch(() => null);
    if (res?.status === 401) return void (window.location.href = "/auth/login");
    if (!res?.ok) return setError((await res?.json().catch(() => null))?.error ?? "Lost touch with the app server.");
    setBoard(await res.json());
    setError("");
  }, []);

  useEffect(() => {
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, [refresh]);

  const night = board?.night ?? null;
  const chores = board?.chores ?? [];
  const held = chores.filter((c) => isHeld(c.state));
  const log = announcements(chores, night).slice(-14);

  return (
    <main className="mx-auto grid max-w-[1320px] gap-10 px-4 pb-20 pt-6 sm:px-10 sm:pt-10 lg:grid-cols-[1fr_360px] lg:gap-14">
      <section className="min-w-0">
        <h1 className="mb-5 text-[52px] font-black leading-[0.9] tracking-[-0.045em] sm:text-[88px]">Departures tonight</h1>
        <p className="mb-9 max-w-[60ch] text-lg">{subline(board)}</p>
        {error && (
          <p role="alert" className="mb-6 flex items-center gap-2 border-l-4 border-signal py-1 pl-3 font-bold text-signal-ink">
            <WarningIcon size={18} aria-hidden />
            {error}
          </p>
        )}

        <table className="w-full border-collapse max-md:block">
          <thead className="max-md:hidden">
            <tr className="font-mono text-xs text-ink-2">
              {["Time", "Chore", "Site", "Status"].map((h) => (
                <th key={h} scope="col" className="border-b-[3px] border-ink pb-3 pr-4 text-left font-bold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="max-md:block">
            {chores.length === 0 && (
              <tr className="max-md:block">
                <td colSpan={4} className="border-b border-line py-6 text-ink-2 max-md:block">
                  No run yet. Pick tonight&rsquo;s chores and start one.
                </td>
              </tr>
            )}
            {chores.map((c) => {
              const row = describeRow(c, night);
              const Glyph = icons[row.tone];
              const isHeldRow = row.tone === "held";
              return (
                <tr
                  key={c.workflowId}
                  className="border-b border-line align-top max-md:grid max-md:grid-cols-[84px_1fr] max-md:py-3.5"
                >
                  <td
                    className={`w-[110px] py-[18px] pr-4 font-mono text-[26px] font-bold leading-none tnum max-md:row-span-3 max-md:w-auto max-md:py-0 max-md:text-xl ${
                      isHeldRow ? "border-l-4 border-signal pl-3.5 text-signal max-md:pl-2.5" : ""
                    }`}
                  >
                    {row.time}
                    {row.was && (
                      <s className="mt-1.5 block text-[13px] font-normal text-ink-2">{row.was}</s>
                    )}
                  </td>
                  <td className="py-[18px] pr-4 max-md:py-0 max-md:pb-1">
                    <b className="block text-[19px] font-extrabold leading-tight tracking-[-0.01em]">{c.title}</b>
                    <span className="text-[15px] text-ink-2">{row.note}</span>
                  </td>
                  <td className="w-[130px] py-[18px] pr-4 font-mono text-[13px] capitalize text-ink-2 max-md:w-auto max-md:py-0 max-md:pb-1">
                    {c.site}
                  </td>
                  <td
                    className={`w-[190px] py-[18px] font-mono text-[13px] font-bold uppercase leading-snug max-md:w-auto max-md:py-0 ${statusColor[row.tone]}`}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <Glyph size={16} aria-hidden className="shrink-0" />
                      {row.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <section aria-labelledby="ann" className="mt-10 grid gap-2.5 md:grid-cols-[130px_1fr] md:gap-6">
          <h2 id="ann" className="pt-1 text-[15px] font-extrabold leading-tight">
            Announcements
          </h2>
          <ol className="text-[15px]">
            {log.length === 0 && <li className="border-t border-line py-1.5 text-ink-2">Nothing yet tonight.</li>}
            {log.map((l) => (
              <motion.li
                key={l.key}
                layout="position"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="grid grid-cols-[64px_1fr] border-t border-line py-1.5"
              >
                <time className="font-mono text-ink-2 tnum">{clock(l.at)}</time>
                <span>{l.text}</span>
              </motion.li>
            ))}
          </ol>
        </section>
      </section>

      <aside className="flex flex-col gap-8 self-start lg:sticky lg:top-8 max-lg:order-first max-lg:max-w-[420px]">
        {held.map((c) => (
          <div key={c.workflowId}>
            <p className="mb-3 font-mono text-xs text-ink-2">
              {night && Date.now() < night.wakeAt ? `Held until ${clock(night.wakeAt)}` : "Waiting for you"}
              {" · "}
              <a href={`/approve/${c.workflowId}`} className="underline underline-offset-2 hover:text-ink">
                open on phone
              </a>
            </p>
            <Ticket chore={c} night={night} onDone={refresh} />
          </div>
        ))}
        {(!night || !night.running) && board && <StartRun catalog={board.catalog} onStarted={refresh} />}
        {night?.running && held.length === 0 && (
          <p className="flex items-start gap-2 border-[3px] border-ink p-4 leading-snug">
            <ClockIcon size={20} aria-hidden className="mt-0.5 shrink-0 text-ink-2" />
            <span>
              Nothing needs you right now. Risky steps show up here as a ticket, and on your phone after{" "}
              {clock(night.wakeAt)}.
            </span>
          </p>
        )}
      </aside>
    </main>
  );
}

function subline(board: Board | null) {
  if (!board) return "The board could not load.";
  const { night, chores } = board;
  if (!night) return "Nothing has left yet. Pick the chores, set when you wake up, and go to bed.";
  const parts = [`${chores.length} chores. Night run left at ${clock(night.startedAt)}.`];
  const heldCount = chores.filter((c) => isHeld(c.state)).length;
  if (heldCount === 1) parts.push("One is held until you approve it.");
  else if (heldCount > 1) parts.push(`${heldCount} are held until you approve them.`);
  else if (!night.running) parts.push("The run has finished.");
  return parts.join(" ");
}
