"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db, isFirebaseConfigured } from "@/lib/firebase/client";
import { BillboardDoc, DEFAULT_BILLBOARD } from "@/lib/firebase/types";
import { trackView } from "@/lib/firebase/engagement";

const VIEWED_CLAIM_KEY = "billboard_viewed_claim_count";

export function useBillboard() {
  const [billboard, setBillboard] = useState<BillboardDoc>(DEFAULT_BILLBOARD);
  const [loading, setLoading] = useState(isFirebaseConfigured);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      // Sem credenciais do Firebase ainda: mostramos o estado padrão
      // pra a cena 3D e a UI continuarem navegáveis em dev.
      return;
    }

    const ref = doc(db, "billboard", "current");
    const unsub = onSnapshot(
      ref,
      (snap) => {
        setLoading(false);
        if (snap.exists()) {
          // merge com os defaults: um doc criado só pelo trackEngagement
          // (visita antes de qualquer claim) não tem todos os campos.
          setBillboard({
            ...DEFAULT_BILLBOARD,
            ...(snap.data() as Partial<BillboardDoc>),
          });
        } else {
          setBillboard(DEFAULT_BILLBOARD);
        }
      },
      (err) => {
        setLoading(false);
        setError(err.message);
      },
    );

    return () => unsub();
  }, []);

  // Conta uma visita por reinado do anunciante atual (não a cada render) —
  // um novo claimCount enquanto a aba tá aberta conta como visita do novo.
  useEffect(() => {
    if (!isFirebaseConfigured || loading) return;
    const claimKey = String(billboard.claimCount ?? 0);
    if (sessionStorage.getItem(VIEWED_CLAIM_KEY) === claimKey) return;
    sessionStorage.setItem(VIEWED_CLAIM_KEY, claimKey);
    trackView();
  }, [loading, billboard.claimCount]);

  return { billboard, loading, error };
}
