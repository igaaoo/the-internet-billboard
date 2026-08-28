"use client";

import { useEffect, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { db, isFirebaseConfigured } from "@/lib/firebase/client";
import type { HistoryEntry } from "@/lib/firebase/types";

export function useBillboardHistory(max = 8) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    if (!isFirebaseConfigured) return;

    const q = query(
      collection(db, "billboard", "current", "history"),
      orderBy("claimedAt", "desc"),
      limit(max),
    );
    const unsub = onSnapshot(q, (snap) => {
      setHistory(
        snap.docs.map((d) => ({ id: d.id, ...d.data() }) as HistoryEntry),
      );
    });
    return () => unsub();
  }, [max]);

  return history;
}
