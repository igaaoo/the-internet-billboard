"use client";

import { useEffect, useRef, useState } from "react";
import { Eye, MousePointerClick, Timer } from "lucide-react";
import type { BillboardDoc } from "@/lib/firebase/types";
import { formatCount } from "@/lib/format";
import { LiveDuration } from "./LiveDuration";

/** true por ~450ms sempre que `value` aumenta — dá um pulso visual na hora. */
function useBump(value: number) {
  const [bumped, setBumped] = useState(false);
  const prev = useRef(value);

  useEffect(() => {
    if (value > prev.current) {
      setBumped(true);
      const t = setTimeout(() => setBumped(false), 450);
      prev.current = value;
      return () => clearTimeout(t);
    }
    prev.current = value;
  }, [value]);

  return bumped;
}

/**
 * Vitrine de métricas do anunciante atual — separada do HistoryPanel de
 * propósito, pra ficar no lado esquerdo em vez de dividir espaço com o
 * hall of fame.
 */
export function LiveStatsPanel({ billboard }: { billboard: BillboardDoc }) {
  const clickBump = useBump(billboard.clickCount);
  const viewBump = useBump(billboard.viewCount);

  if (billboard.claimCount === 0) return null;

  return (
    <div className="glass-panel rounded-2xl p-3.5 w-[220px] flex flex-col gap-2 animate-fade-up">
      <p className="text-[10px] uppercase tracking-wider text-ink-500 truncate">
        live stats · {billboard.brandName}
      </p>

      <div className="rounded-xl bg-orange-500 px-3 py-2 flex items-center gap-2.5 transition-transform duration-300 hover:scale-[1.02]">
        <Timer size={16} className="text-cream-50 shrink-0" />
        <div className="leading-tight min-w-0">
          <p className="text-[9px] uppercase tracking-wider text-cream-50/80">
            on air for
          </p>
          <p className="text-sm font-semibold text-cream-50 tabular-nums">
            {billboard.claimedAt ? (
              <LiveDuration sinceSeconds={billboard.claimedAt.seconds} />
            ) : (
              "—"
            )}
          </p>
        </div>
      </div>

      <div
        className={`rounded-xl bg-white/60 border px-3 py-2 flex items-center gap-2.5 transition-all duration-300 ${
          viewBump
            ? "scale-[1.03] border-orange-500"
            : "border-tan-400/40 hover:scale-[1.02]"
        }`}
      >
        <Eye size={16} className="text-orange-600 shrink-0" />
        <div className="leading-tight">
          <p className="text-[9px] uppercase tracking-wider text-ink-500">
            views on this ad
          </p>
          <p className="text-sm font-semibold text-ink-900 tabular-nums">
            {formatCount(billboard.viewCount)}
          </p>
        </div>
      </div>

      <div
        className={`rounded-xl bg-white/60 border px-3 py-2 flex items-center gap-2.5 transition-all duration-300 ${
          clickBump
            ? "scale-[1.03] border-orange-500"
            : "border-tan-400/40 hover:scale-[1.02]"
        }`}
      >
        <MousePointerClick size={16} className="text-orange-600 shrink-0" />
        <div className="leading-tight">
          <p className="text-[9px] uppercase tracking-wider text-ink-500">
            clicks on this ad
          </p>
          <p className="text-sm font-semibold text-ink-900 tabular-nums">
            {formatCount(billboard.clickCount)}
          </p>
        </div>
      </div>
    </div>
  );
}
