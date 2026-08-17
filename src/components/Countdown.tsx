"use client";

import { useEffect, useState } from "react";

export default function Countdown({ targetDate, label }: { targetDate: string | null | undefined; label: string }) {
  const [remaining, setRemaining] = useState<{ d: number; h: number; m: number; s: number } | null>(null);

  useEffect(() => {
    if (!targetDate) return;
    const target = new Date(targetDate).getTime();
    function tick() {
      const diff = target - Date.now();
      if (diff <= 0) {
        setRemaining({ d: 0, h: 0, m: 0, s: 0 });
        return;
      }
      setRemaining({
        d: Math.floor(diff / 86400000),
        h: Math.floor((diff % 86400000) / 3600000),
        m: Math.floor((diff % 3600000) / 60000),
        s: Math.floor((diff % 60000) / 1000),
      });
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetDate]);

  if (!targetDate || !remaining) return null;

  const units = [
    { v: remaining.d, l: "Days" },
    { v: remaining.h, l: "Hours" },
    { v: remaining.m, l: "Min" },
    { v: remaining.s, l: "Sec" },
  ];

  return (
    <div className="flex flex-col items-center">
      <div className="text-[11px] uppercase tracking-[0.25em] text-orange font-semibold mb-3">{label}</div>
      <div className="flex gap-3">
        {units.map((u) => (
          <div key={u.l} className="w-16 sm:w-20 rounded-xl border border-lineBright bg-bgCard text-center py-3">
            <div className="text-2xl sm:text-3xl font-bold font-display text-goldBright">{String(u.v).padStart(2, "0")}</div>
            <div className="text-[9px] uppercase tracking-wide text-mutedDim mt-0.5">{u.l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
