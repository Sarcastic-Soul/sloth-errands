"use client";
import { useEffect, useState } from "react";
import { clock } from "@/lib/view";

export function Clock() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(t);
  }, []);
  return (
    <time className="font-mono text-xl font-bold leading-none tnum sm:text-[26px]" suppressHydrationWarning>
      {now ? clock(now) : "--:--"}
    </time>
  );
}
