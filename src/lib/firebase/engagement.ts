"use client";

import { httpsCallable } from "firebase/functions";
import { functions, isFirebaseConfigured } from "@/lib/firebase/client";

type EngagementType = "view" | "click";

/**
 * Dispara e esquece — se falhar (offline, function fria demora etc.) não
 * bloqueia nem avisa o usuário, é só uma métrica.
 */
function trackEngagement(type: EngagementType) {
  if (!isFirebaseConfigured) return;
  const fn = httpsCallable(functions, "trackEngagement");
  fn({ type }).catch(() => {});
}

export const trackView = () => trackEngagement("view");
export const trackClick = () => trackEngagement("click");

export function trackSiteVisit() {
  if (!isFirebaseConfigured) return;
  const fn = httpsCallable(functions, "trackSiteVisit");
  fn().catch(() => {});
}

export function trackHistoryClick(historyId: string) {
  if (!isFirebaseConfigured) return;
  const fn = httpsCallable(functions, "trackHistoryClick");
  fn({ historyId }).catch(() => {});
}
