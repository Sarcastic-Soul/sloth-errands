"use client";
import { useState } from "react";
import { ArrowRightIcon } from "@phosphor-icons/react";
import type { Board } from "@/lib/temporal";

// Pick tonight's chores and when you wake up, then send the night run off
export function StartRun({ catalog, onStarted }: { catalog: Board["catalog"]; onStarted: () => void }) {
  const [picked, setPicked] = useState(() => new Set(catalog.map((c) => c.id)));
  const [demo, setDemo] = useState(true);
  const [wakeIn, setWakeIn] = useState(2);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const toggle = (id: string) =>
    setPicked((p) => {
      const next = new Set(p);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/night", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ choreIds: [...picked], demo, wakeInMin: wakeIn }),
    });
    setBusy(false);
    if (res.status === 401) return void (window.location.href = "/auth/login");
    if (!res.ok) return setError((await res.json().catch(() => ({}))).error ?? "Could not start the run.");
    onStarted();
  }

  return (
    <form onSubmit={submit} className="border-[3px] border-ink">
      <h2 className="border-b-[3px] border-ink px-4 py-3 text-lg font-extrabold leading-tight">Book tonight&rsquo;s run</h2>
      <fieldset className="px-4 pt-2">
        <legend className="sr-only">Chores</legend>
        {catalog.map((c) => (
          <label key={c.id} className="flex cursor-pointer items-start gap-3 border-b border-line py-2.5 last:border-b-0">
            <input
              type="checkbox"
              checked={picked.has(c.id)}
              onChange={() => toggle(c.id)}
              className="mt-1 size-4 shrink-0 cursor-pointer accent-ink"
            />
            <span className="leading-snug">
              <span className="font-bold">{c.title}</span>
              {c.risky && <span className="ml-1.5 text-sm text-signal-ink">asks first</span>}
            </span>
          </label>
        ))}
      </fieldset>
      <div className="grid grid-cols-2 gap-3 border-t-[3px] border-ink px-4 py-3">
        <label className="flex flex-col gap-1 text-sm text-ink-2">
          Wake up in
          <span className="flex items-baseline gap-1.5 text-ink">
            <input
              type="number"
              min={0}
              max={720}
              value={wakeIn}
              onChange={(e) => setWakeIn(Number(e.target.value))}
              className="w-16 border-2 border-ink bg-bg px-2 py-1 font-mono text-base font-bold tnum"
            />
            min
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-2 pt-6 text-sm leading-snug">
          <input type="checkbox" checked={demo} onChange={(e) => setDemo(e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-ink" />
          Demo pace (retries in seconds)
        </label>
      </div>
      {error && <p role="alert" className="px-4 pb-2 text-sm font-bold text-signal-ink">{error}</p>}
      <button
        type="submit"
        disabled={busy || picked.size === 0}
        className="flex min-h-[54px] w-full cursor-pointer items-center justify-between bg-ink px-4 text-base font-extrabold text-bg transition-colors hover:bg-[#33353a] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? "Starting" : `Start tonight's run · ${picked.size}`}
        <ArrowRightIcon size={20} aria-hidden />
      </button>
    </form>
  );
}
