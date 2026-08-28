import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { onCall, HttpsError, onRequest } from "firebase-functions/v2/https";
import { defineString } from "firebase-functions/params";
import { logger } from "firebase-functions";
import type Stripe from "stripe";

import { getStripeClient, stripeSecretKey, stripeWebhookSecret } from "./stripeClient";
import { computeMinNextPriceCents } from "./pricing";
import { isSafeHttpUrl } from "./validation";
import type { ClaimDraft } from "./types";

initializeApp();
const db = getFirestore();

const siteUrl = defineString("SITE_URL", {
  default: "https://theinternetbillboard.lol",
});

// Restringe quem pode chamar as callables via navegador — não impede
// abuso direto via curl/script (isso não existe pra endpoint público),
// mas barra scripts rodando em outros sites de abusarem via CORS.
const ALLOWED_ORIGINS = [
  "https://theinternetbillboard.lol",
  "https://www.theinternetbillboard.lol",
  /^http:\/\/localhost:\d+$/,
];

const BILLBOARD_REF = () => db.collection("billboard").doc("current");
const SITE_STATS_REF = () => db.collection("stats").doc("site");
// Documento separado, nunca lido pelo cliente — só aqui vive o e-mail do
// dono atual, pra não expor PII no doc público billboard/current.
const BILLBOARD_PRIVATE_REF = () => db.collection("billboardPrivate").doc("current");

/**
 * Callable chamada pelo front-end quando alguém tenta assumir o billboard.
 * Valida o valor no servidor (nunca confia no preço vindo do cliente) e
 * cria uma Stripe Checkout Session.
 */
export const createCheckoutSession = onCall(
  { secrets: [stripeSecretKey], cors: ALLOWED_ORIGINS },
  async (request) => {
    const data = request.data as ClaimDraft;

    if (!data?.brandName?.trim()) {
      throw new HttpsError("invalid-argument", "brandName é obrigatório.");
    }
    if (!data?.email?.trim()) {
      throw new HttpsError("invalid-argument", "email é obrigatório.");
    }
    if (!Number.isFinite(data.priceCents) || data.priceCents <= 0) {
      throw new HttpsError("invalid-argument", "priceCents inválido.");
    }
    if (data.priceCents % 100 !== 0) {
      throw new HttpsError(
        "invalid-argument",
        "O lance precisa ser em reais inteiros, sem centavos.",
      );
    }
    if (data.brandName.length > 120) {
      throw new HttpsError("invalid-argument", "brandName muito longo.");
    }
    if (data.tagline && data.tagline.length > 300) {
      throw new HttpsError("invalid-argument", "tagline muito longa.");
    }
    for (const [field, value] of [
      ["linkUrl", data.linkUrl],
      ["imageUrl", data.imageUrl],
      ["iconUrl", data.iconUrl],
    ] as const) {
      if (!value) continue;
      if (value.length > 500) {
        throw new HttpsError("invalid-argument", `${field} muito longo.`);
      }
      if (!isSafeHttpUrl(value)) {
        throw new HttpsError(
          "invalid-argument",
          `${field} precisa ser uma URL http(s) válida e pública.`,
        );
      }
    }

    const billboardSnap = await BILLBOARD_REF().get();
    const current = billboardSnap.exists ? billboardSnap.data() : null;
    const currentPrice = current?.priceCents ?? 0;
    const minNext = computeMinNextPriceCents(currentPrice);

    if (data.priceCents < minNext) {
      throw new HttpsError(
        "failed-precondition",
        `O lance mínimo agora é de ${(minNext / 100).toFixed(2)} (BRL).`,
      );
    }

    const stripe = getStripeClient();

    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "brl",
              unit_amount: Math.round(data.priceCents),
              product_data: {
                name: `The Internet Billboard — ${data.brandName}`.slice(0, 120),
                description: "Assumir o billboard com o seu anúncio",
              },
            },
            quantity: 1,
          },
        ],
        customer_email: data.email,
        success_url: `${siteUrl.value()}?claim=success`,
        cancel_url: `${siteUrl.value()}?claim=cancelled`,
        metadata: {
          brandName: data.brandName.slice(0, 120),
          tagline: (data.tagline ?? "").slice(0, 160),
          linkUrl: (data.linkUrl ?? "").slice(0, 500),
          bgColor: data.bgColor || "#f2601a",
          textColor: data.textColor || "#fff6e8",
          imageUrl: (data.imageUrl ?? "").slice(0, 500),
          iconUrl: (data.iconUrl ?? "").slice(0, 500),
          email: data.email.slice(0, 200),
          priceCents: String(Math.round(data.priceCents)),
        },
      },
      // com a mesma requestId (gerada uma vez por tentativa no cliente), um
      // retry de rede não cria uma segunda sessão/cobrança duplicada.
      data.requestId ? { idempotencyKey: data.requestId } : undefined,
    );

    // guarda o rascunho pendente pra o webhook aplicar depois de confirmado
    await db.collection("pendingClaims").doc(session.id).set({
      status: "pending",
      createdAt: FieldValue.serverTimestamp(),
      ...data,
    });

    return { url: session.url };
  },
);

/**
 * Callable leve chamada pelo front-end pra contar visitas e cliques do
 * anúncio atual. Não confia em nada vindo do cliente além do tipo do
 * evento — o incremento em si é sempre feito pelo Admin SDK.
 */
export const trackEngagement = onCall({ cors: ALLOWED_ORIGINS }, async (request) => {
  const type = (request.data as { type?: string })?.type;
  if (type !== "view" && type !== "click") {
    throw new HttpsError("invalid-argument", "type deve ser 'view' ou 'click'.");
  }

  const field = type === "view" ? "viewCount" : "clickCount";
  await BILLBOARD_REF().set({ [field]: FieldValue.increment(1) }, { merge: true });
  return { ok: true };
});

/**
 * Contador global de visitantes do site — nunca zera (diferente do
 * viewCount do billboard, que reinicia a cada troca de dono).
 */
export const trackSiteVisit = onCall({ cors: ALLOWED_ORIGINS }, async () => {
  await SITE_STATS_REF().set(
    { totalVisitors: FieldValue.increment(1) },
    { merge: true },
  );
  return { ok: true };
});

/**
 * Clique num anúncio antigo do hall of fame — incrementa o clickCount
 * daquela entrada específica do histórico (não a do dono atual).
 */
export const trackHistoryClick = onCall({ cors: ALLOWED_ORIGINS }, async (request) => {
  const historyId = (request.data as { historyId?: string })?.historyId;
  if (!historyId || typeof historyId !== "string") {
    throw new HttpsError("invalid-argument", "historyId é obrigatório.");
  }

  const ref = BILLBOARD_REF().collection("history").doc(historyId);
  const snap = await ref.get();
  if (!snap.exists) {
    return { ok: true }; // entrada não existe (mais) — ignora silenciosamente
  }

  await ref.set({ clickCount: FieldValue.increment(1) }, { merge: true });
  return { ok: true };
});

/**
 * Webhook do Stripe. Precisa do corpo cru (rawBody) pra validar a
 * assinatura — por isso é uma onRequest, não uma onCall.
 */
export const stripeWebhook = onRequest(
  { secrets: [stripeSecretKey, stripeWebhookSecret] },
  async (req, res) => {
    const stripe = getStripeClient();
    const signature = req.headers["stripe-signature"];

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        req.rawBody,
        signature as string,
        stripeWebhookSecret.value(),
      );
    } catch (err) {
      logger.error("Assinatura do webhook inválida", err);
      res.status(400).send("Webhook signature verification failed.");
      return;
    }

    if (event.type !== "checkout.session.completed") {
      res.status(200).send("ignored");
      return;
    }

    const session = event.data.object as Stripe.Checkout.Session;
    const pendingRef = db.collection("pendingClaims").doc(session.id);

    try {
      await db.runTransaction(async (tx) => {
        const pendingSnap = await tx.get(pendingRef);
        if (!pendingSnap.exists) {
          logger.warn(`pendingClaims/${session.id} não encontrado`);
          return;
        }
        const pending = pendingSnap.data()!;
        if (pending.status === "completed") {
          return; // evento duplicado do Stripe, já processado
        }

        const billboardRef = BILLBOARD_REF();
        const billboardSnap = await tx.get(billboardRef);
        const current = billboardSnap.exists ? billboardSnap.data()! : null;

        const paidCents = session.amount_total ?? pending.priceCents;
        const currentPrice = current?.priceCents ?? 0;
        const minNextAtPaymentTime = computeMinNextPriceCents(currentPrice);

        if (paidCents < minNextAtPaymentTime) {
          // alguém pagou mais enquanto esse checkout estava em aberto —
          // marca pra reembolso manual em vez de sobrescrever o dono atual.
          tx.set(
            pendingRef,
            { status: "needs_refund", paidCents },
            { merge: true },
          );
          // error (não warn) de propósito: isso é dinheiro de cliente parado
          // esperando reembolso manual — precisa aparecer no Error Reporting.
          logger.error(
            `Checkout ${session.id} pagou menos que o mínimo atual — sinalizado pra reembolso manual (needs_refund).`,
          );
          return;
        }

        if (current && current.claimCount > 0) {
          const historyRef = billboardRef.collection("history").doc();
          tx.set(historyRef, {
            brandName: current.brandName,
            bgColor: current.bgColor,
            textColor: current.textColor,
            iconUrl: current.iconUrl ?? "",
            linkUrl: current.linkUrl ?? "",
            priceCents: current.priceCents,
            claimedAt: current.claimedAt ?? null,
            viewCount: current.viewCount ?? 0,
            clickCount: current.clickCount ?? 0,
          });
        }

        tx.set(billboardRef, {
          brandName: pending.brandName,
          tagline: pending.tagline ?? "",
          linkUrl: pending.linkUrl ?? "",
          bgColor: pending.bgColor,
          textColor: pending.textColor,
          imageUrl: pending.imageUrl ?? "",
          iconUrl: pending.iconUrl ?? "",
          priceCents: paidCents,
          minNextPriceCents: computeMinNextPriceCents(paidCents),
          claimedAt: FieldValue.serverTimestamp(),
          claimCount: (current?.claimCount ?? 0) + 1,
          // zera as métricas do anúncio anterior — cada reinado conta as suas.
          viewCount: 0,
          clickCount: 0,
        });

        // e-mail fica só nesse doc privado — nunca no billboard/current público.
        tx.set(BILLBOARD_PRIVATE_REF(), { ownerEmail: pending.email });

        tx.set(pendingRef, { status: "completed" }, { merge: true });
      });

      res.status(200).send("ok");
    } catch (err) {
      logger.error("Falha ao aplicar checkout.session.completed", err);
      res.status(500).send("internal error");
    }
  },
);

