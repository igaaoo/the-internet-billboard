"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Eye } from "lucide-react";
import { useBillboard } from "@/hooks/useBillboard";
import { useBillboardHistory } from "@/hooks/useBillboardHistory";
import { useSiteVisitors } from "@/hooks/useSiteVisitors";
import { isFirebaseConfigured } from "@/lib/firebase/client";
import type { BillboardDoc } from "@/lib/firebase/types";
import { formatCount } from "@/lib/format";
import { HistoryPanel } from "@/components/ui/HistoryPanel";
import { LiveStatsPanel } from "@/components/ui/LiveStatsPanel";
import { BottomBar } from "@/components/ui/BottomBar";
import { ClaimModal } from "@/components/ui/ClaimModal";

const BillboardScene = dynamic(
  () =>
    import("@/components/scene/BillboardScene").then((m) => m.BillboardScene),
  {
    ssr: false,
    loading: () => (
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 animate-pulse-soft">
          <span className="text-3xl">🔶</span>
          <p className="text-sm text-ink-500">turning on the lights…</p>
        </div>
      </div>
    ),
  },
);

export default function Home() {
  const { billboard } = useBillboard();
  const history = useBillboardHistory(5);
  const totalVisitors = useSiteVisitors();
  const [claimOpen, setClaimOpen] = useState(false);
  const [previewOverride, setPreviewOverride] = useState<BillboardDoc | null>(
    null,
  );

  // sem Firebase configurado, o billboard exibido é a prévia local (se
  // houver uma) — assim dá pra testar com a marca/produto de quem tá
  // mexendo no projeto antes mesmo de configurar pagamentos de verdade.
  const displayedBillboard = previewOverride ?? billboard;
  const isPreview = !isFirebaseConfigured && previewOverride !== null;

  return (
    <main className="relative h-full w-full">
      <div className="absolute inset-0">
        <BillboardScene billboard={displayedBillboard} />
      </div>

      {/* header compacto, só no mobile (o brand mark ao lado assume no desktop) */}
      <div className="pointer-events-none absolute top-4 left-4 right-4 flex md:hidden items-center justify-between">
        <div className="pointer-events-auto glass-panel rounded-full px-3.5 py-2 flex items-center gap-2">
          <span className="text-base">🔶</span>
          <span className="font-display text-sm text-ink-900">
            The Internet Billboard
          </span>
        </div>
      </div>

      {isPreview && (
        <div className="pointer-events-none absolute top-4 left-1/2 -translate-x-1/2 flex justify-center">
          <div className="pointer-events-auto glass-panel rounded-full px-4 py-1.5 flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-pulse-soft" />
            <span className="text-xs text-ink-700">
              Local preview — only visible in your browser
            </span>
            <button
              onClick={() => setPreviewOverride(null)}
              className="text-xs text-orange-600 font-semibold hover:text-orange-700 cursor-pointer ml-1"
            >
              clear
            </button>
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute inset-0 flex items-start justify-between p-6 pt-12">
        <div className="hidden md:flex flex-col gap-4">
          <div className="pointer-events-auto flex items-center glass-panel rounded-3xl px-5 py-4 gap-3.5 animate-fade-up">
            <div className="leading-tight">
              <p className="font-display text-2xl text-ink-900">
                The Internet Billboard
              </p>
              <p className="text-[11px] uppercase tracking-wider text-ink-500 mt-1">
                <strong>Skip the ranking wars.</strong> own the internet&apos;s
                only billboard.
              </p>
              {totalVisitors > 0 && (
                <p className="flex items-center gap-1 text-[11px] text-ink-500 mt-1.5">
                  <Eye size={12} className="shrink-0" />
                  {formatCount(totalVisitors)} people have seen this site
                </p>
              )}
            </div>
          </div>
          <div className="pointer-events-auto">
            <LiveStatsPanel billboard={displayedBillboard} />
          </div>
        </div>
        <div className="flex items-center">
          <HistoryPanel billboard={displayedBillboard} history={history} />
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-10 flex justify-center px-4">
        <BottomBar
          billboard={displayedBillboard}
          onClaim={() => setClaimOpen(true)}
        />
      </div>

      {claimOpen && (
        <ClaimModal
          billboard={displayedBillboard}
          onClose={() => setClaimOpen(false)}
          onPreview={setPreviewOverride}
        />
      )}
    </main>
  );
}
