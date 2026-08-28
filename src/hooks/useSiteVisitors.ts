"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db, isFirebaseConfigured } from "@/lib/firebase/client";
import { trackSiteVisit } from "@/lib/firebase/engagement";

const VISIT_TRACKED_KEY = "site_visit_tracked";

/** Total de visitantes do site inteiro, desde sempre — nunca zera. */
export function useSiteVisitors() {
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    const ref = doc(db, "stats", "site");
    const unsub = onSnapshot(ref, (snap) => {
      setTotal((snap.data()?.totalVisitors as number | undefined) ?? 0);
    });
    return () => unsub();
  }, []);

  // Conta uma visita só uma vez por sessão de navegador (não a cada render
  // nem a cada troca de dono do billboard — isso aqui é site-wide).
  useEffect(() => {
    if (!isFirebaseConfigured) return;
    if (sessionStorage.getItem(VISIT_TRACKED_KEY)) return;
    sessionStorage.setItem(VISIT_TRACKED_KEY, "1");
    trackSiteVisit();
  }, []);

  return total;
}
