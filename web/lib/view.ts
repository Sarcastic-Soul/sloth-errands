import type { ChoreState } from "../../src/temporal/workflows";
import type { BoardChore, Night } from "./temporal";

// Everything on the board is in the user's own time zone (India)
export const clock = (t: number) =>
  new Date(t).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" });

export type Tone = "done" | "held" | "delay" | "wait" | "run" | "fail" | "off";

export type Row = {
  time: string;
  was?: string; // the planned time, struck through when it moved
  label: string;
  tone: Tone;
  note: string;
};

export const isHeld = (s: ChoreState | null) => !!s?.proposal && (s.status === "waiting" || s.status === "asking");

export const heldSince = (s: ChoreState) => s.log.findLast((l) => l.text.startsWith("Held for your OK"))?.at;

export function describeRow(c: BoardChore, night: Night | null): Row {
  const s = c.state;
  if (!s) return { time: "--:--", label: "Worker off", tone: "off", note: "Start the worker to see this chore." };
  const first = s.log[0]?.at;
  const last = s.log.at(-1);
  const note = s.summary || last?.text || "";
  const start = first ? clock(first) : "--:--";

  if (isHeld(s)) {
    const since = heldSince(s);
    const wake = night?.wakeAt;
    const beforeWake = wake && Date.now() < wake;
    return {
      time: beforeWake ? clock(wake) : since ? clock(since) : start,
      was: beforeWake && since ? clock(since) : undefined,
      label: "Held for you",
      tone: "held",
      note: s.proposal!.summary,
    };
  }
  switch (s.status) {
    case "done":
      return { time: last ? clock(last.at) : start, label: "Done", tone: "done", note };
    case "retrying": {
      const tries = s.log.filter((l) => l.text.startsWith("Site did not answer"));
      const next = tries.at(-1)?.text.match(/at (\d\d:\d\d)/)?.[1];
      return { time: next ?? start, was: next ? start : undefined, label: `Delayed · try ${tries.length}/5`, tone: "delay", note: last?.text ?? "" };
    }
    case "waiting":
      return { time: last ? clock(last.at) : start, was: first ? start : undefined, label: "Waiting", tone: "wait", note: last?.text ?? "" };
    case "running":
      return { time: start, label: "On time", tone: "run", note: s.attempts > 1 ? `Trying again (${s.attempts})` : "Working on it now" };
    case "denied":
      return { time: last ? clock(last.at) : start, label: "Cancelled", tone: "off", note };
    default:
      return { time: last ? clock(last.at) : start, was: first ? start : undefined, label: "Failed", tone: "fail", note };
  }
}

export type Announcement = { at: number; key: string; text: string };

export function announcements(chores: BoardChore[], night: Night | null): Announcement[] {
  const lines: Announcement[] = [];
  if (night) lines.push({ at: night.startedAt, key: "start", text: `Night run started with ${chores.length} chores.` });
  for (const c of chores) {
    c.state?.log.forEach((l, i) => lines.push({ at: l.at, key: `${c.choreId}-${i}`, text: `${c.title}: ${l.text}` }));
  }
  return lines.sort((a, b) => a.at - b.at);
}
