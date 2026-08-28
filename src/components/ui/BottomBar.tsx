"use client";

import type { BillboardDoc } from "@/lib/firebase/types";
import { formatUSD } from "@/lib/format";

export function BottomBar({
  billboard,
  onClaim,
}: {
  billboard: BillboardDoc;
  onClaim: () => void;
}) {
  return (
    <div className="pointer-events-auto glass-panel rounded-full pl-5 pr-2 py-2 flex items-center gap-4 sm:gap-5 animate-fade-up shadow-lg">
      <div className="hidden sm:flex flex-col leading-tight pr-1">
        <span className="text-[10px] uppercase tracking-wider text-ink-500">
          current bid
        </span>
        <span className="font-display text-lg text-ink-900">
          {billboard.claimCount > 0 ? formatUSD(billboard.priceCents) : "free"}
        </span>
      </div>

      <div className="hidden sm:block h-8 w-px bg-tan-400/40" />

      <div className="flex flex-col leading-tight pr-1">
        <span className="text-[10px] uppercase tracking-wider text-ink-500">
          minimum next bid
        </span>
        <span className="font-display text-lg text-orange-600">
          {formatUSD(billboard.minNextPriceCents)}
        </span>
      </div>

      <button
        onClick={onClaim}
        className="btn-cta rounded-full px-6 py-3 text-sm font-semibold whitespace-nowrap cursor-pointer"
      >
        CLAIM THE BILLBOARD
      </button>
    </div>
  );
}
