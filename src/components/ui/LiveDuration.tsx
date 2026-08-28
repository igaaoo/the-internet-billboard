"use client";

import { useEffect, useState } from "react";
import { formatDuration } from "@/lib/format";

/**
 * Cronômetro ao vivo, isolado num componente próprio pra o tick de 1s não
 * re-renderizar o resto do painel — só esse texto atualiza.
 */
export function LiveDuration({ sinceSeconds }: { sinceSeconds: number }) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  return <>{formatDuration(nowMs / 1000 - sinceSeconds)}</>;
}
