"use client";

import type { BillboardDoc, HistoryEntry } from "@/lib/firebase/types";
import { formatUSD, formatCount, formatDuration } from "@/lib/format";
import { trackHistoryClick } from "@/lib/firebase/engagement";

export function HistoryPanel({
  billboard,
  history,
}: {
  billboard: BillboardDoc;
  history: HistoryEntry[];
}) {
  return (
    <aside className="pointer-events-auto hidden lg:flex flex-col gap-4 w-[280px] glass-panel rounded-3xl p-6 animate-fade-up">
      <div>
        <p className="text-[11px] uppercase tracking-wider text-ink-500">
          on air now
        </p>
        <div className="mt-2 flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full bg-orange-500 animate-pulse-soft"
            aria-hidden
          />
          <p className="font-display text-xl text-ink-900 truncate">
            {billboard.brandName || "empty"}
          </p>
        </div>
        {billboard.claimCount > 0 ? (
          <p className="text-sm text-ink-700 mt-1">
            bid {formatUSD(billboard.priceCents)}
          </p>
        ) : (
          <p className="text-sm text-ink-700 mt-1">no one has claimed it yet</p>
        )}
      </div>

      <div className="h-px bg-tan-400/40" />

      <div>
        <p className="text-[11px] uppercase tracking-wider text-ink-500 mb-3">
          hall of fame
        </p>
        {history.length === 0 ? (
          <p className="text-sm text-ink-500 leading-relaxed">
            previous owners appear here once the first billboard is claimed.
          </p>
        ) : (
          <ul className="flex flex-col gap-2.5 max-h-56 overflow-y-auto pr-1">
            {history.map((h, i) => {
              const startSeconds = h.claimedAt?.seconds;
              const endSeconds =
                i === 0
                  ? billboard.claimedAt?.seconds
                  : history[i - 1].claimedAt?.seconds;
              const durationLabel =
                startSeconds != null && endSeconds != null
                  ? formatDuration(endSeconds - startSeconds)
                  : null;

              return (
                <li
                  key={`${h.brandName}-${h.claimedAt?.seconds ?? i}`}
                  onClick={() => {
                    if (!h.linkUrl) return;
                    trackHistoryClick(h.id);
                    window.open(h.linkUrl, "_blank");
                  }}
                  className={`flex items-center gap-2.5 rounded-lg -mx-1.5 px-1.5 py-1 transition-colors ${
                    h.linkUrl ? "cursor-pointer hover:bg-white/50" : ""
                  }`}
                >
                  {h.iconUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={h.iconUrl}
                      alt=""
                      className="h-6 w-6 shrink-0 rounded-md border border-tan-400/50 bg-white object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <span
                      className="h-6 w-6 shrink-0 rounded-md border border-tan-400/50"
                      style={{ background: h.bgColor }}
                      aria-hidden
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-ink-900 truncate leading-tight">
                      {h.brandName}
                    </p>
                    {(durationLabel || h.clickCount > 0) && (
                      <p className="text-[10px] text-ink-500 truncate">
                        {durationLabel ? `on air ${durationLabel}` : ""}
                        {durationLabel && h.clickCount > 0 ? " · " : ""}
                        {h.clickCount > 0 ? `${formatCount(h.clickCount)} clicks` : ""}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-ink-500 shrink-0">
                    {formatUSD(h.priceCents)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
