import Stripe from "stripe";
import { defineSecret } from "firebase-functions/params";

// Definidos como Secrets do Firebase Functions v2 — configure com:
//   firebase functions:secrets:set STRIPE_SECRET_KEY
//   firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
export const stripeSecretKey = defineSecret("STRIPE_SECRET_KEY");
export const stripeWebhookSecret = defineSecret("STRIPE_WEBHOOK_SECRET");

let cachedClient: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (!cachedClient) {
    cachedClient = new Stripe(stripeSecretKey.value(), {
      apiVersion: "2025-02-24.acacia",
    });
  }
  return cachedClient;
}
