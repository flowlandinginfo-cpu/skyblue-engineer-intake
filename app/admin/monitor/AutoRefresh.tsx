"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function AutoRefresh({ intervalSec = 30 }: { intervalSec?: number }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(true);
  const [secondsLeft, setSecondsLeft] = useState(intervalSec);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(new Date());

  useEffect(() => {
    if (!enabled) return;
    const tick = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          router.refresh();
          setLastRefreshed(new Date());
          return intervalSec;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [enabled, intervalSec, router]);

  return (
    <div className="flex items-center gap-3 text-xs">
      <button
        onClick={() => setEnabled(e => !e)}
        className={`rounded-full px-3 py-1 font-medium transition ${
          enabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
        }`}
      >
        {enabled ? `🔄 Auto-refresh ON (${secondsLeft}s)` : "⏸ Auto-refresh OFF"}
      </button>
      {lastRefreshed && (
        <span className="text-slate-400">
          last: {lastRefreshed.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </span>
      )}
    </div>
  );
}
