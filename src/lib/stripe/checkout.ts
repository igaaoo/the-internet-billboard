"use client";

import { httpsCallable } from "firebase/functions";
import { functions, isFirebaseConfigured } from "@/lib/firebase/client";
import type { ClaimDraft } from "@/lib/firebase/types";

type CheckoutResponse = { url: string };

/**
 * Chama a Firebase Function `createCheckoutSession`, que valida o preço
 * no servidor (tem que ser >= minNextPriceCents atual) e devolve a URL
 * de uma Stripe Checkout Session.
 */
export async function requestBillboardCheckout(
  draft: ClaimDraft,
): Promise<string> {
  if (!isFirebaseConfigured) {
    throw new Error(
      "Payments not configured in this environment (Firebase/Stripe keys missing).",
    );
  }
  const createCheckoutSession = httpsCallable<ClaimDraft, CheckoutResponse>(
    functions,
    "createCheckoutSession",
  );
  const result = await createCheckoutSession(draft);
  return result.data.url;
}
