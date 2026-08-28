# The Internet Billboard

A single 3D billboard (Next.js + Three.js) where whoever pays the most
takes over the ad — until the next bid. Payments via Stripe, data in
Firestore, sensitive logic (price validation, checkout, webhook) in
Cloud Functions.

## Stack

- **Front-end:** Next.js 16 (App Router) + TypeScript + Tailwind v4
- **3D:** three.js via `@react-three/fiber`, `@react-three/drei` and
  `@react-three/postprocessing` (bloom, vignette, grain)
- **Data:** Firebase Firestore (`billboard/current` + `billboard/current/history`)
- **Payments:** Stripe Checkout, created and confirmed via Firebase Functions
  (`createCheckoutSession` callable + `stripeWebhook`)

## How the "bidding war" works

There's no timed auction — the price only ever goes up. Each new ad has
to pay at least the next whole real (R$1) above whatever the current
owner paid — no percentage, no cents. That rule lives in
`functions/src/pricing.ts` and is validated **twice on the server**:
once when the checkout session is created, and again inside a
transaction when the Stripe webhook confirms payment (to cover the race
between two simultaneous payments).

## Running locally

```bash
npm install
cp .env.local.example .env.local   # fill in after creating the Firebase project
npm run dev
```

The site works even **without** the Firebase env vars filled in — it
falls back to an "empty" demo billboard so you can see the 3D scene and
UI. The "Claim the billboard" button only works for real after step 2
below.

## 1. Create the Firebase project

1. Create a project at https://console.firebase.google.com
2. **Upgrade to the Blaze plan** (Project settings → Usage and billing).
   This is required even for light usage — Cloud Functions v2 (`onCall`/
   `onRequest`, used here) run on Cloud Run under the hood and simply
   can't deploy on the free Spark plan. The free-tier quotas still apply
   on Blaze (you're only billed for usage past them).
3. Enable **Firestore** (production mode, pick a region close to your
   users, e.g. `southamerica-east1`)
4. Under *Project settings → General*, add a **Web app** and copy the
   config into your `.env.local` (see `.env.local.example`)
5. Edit `.firebaserc` and replace `COLOQUE-AQUI-O-ID-DO-SEU-PROJETO-FIREBASE`
   with your real Project ID
6. Install the CLI (`npm i -g firebase-tools`), run `firebase login`,
   then `firebase use <your-project-id>`

## 2. Create the Stripe account

1. Create an account at https://dashboard.stripe.com. Keep **Test mode**
   on while developing — nothing here needs a live key until you're
   actually ready to take real payments.
2. Grab the **Secret key** (`sk_test_...`)
3. Set the Functions secrets (via Secret Manager — never committed to
   the repo, never touches a file on disk):
   ```bash
   firebase functions:secrets:set STRIPE_SECRET_KEY
   firebase functions:secrets:set STRIPE_WEBHOOK_SECRET   # any placeholder value for now
   ```
4. Set the `SITE_URL` param (used for the Stripe success/cancel
   redirects). Create `functions/.env.<your-project-id>` — this file is
   loaded automatically for deploys/emulation targeting that exact
   project (see `functions/.env.example`). **This is easy to get wrong
   and silently breaks the post-payment redirect** — if it's missing or
   still pointing at `localhost`, real customers get bounced to
   `localhost` right after paying (the billboard still updates fine via
   the webhook either way, but the redirect looks broken):
   ```
   SITE_URL=https://yourdomain.com
   ```
5. Deploy (see step 3 below), then come back here: create a **webhook
   endpoint** in the Stripe Dashboard (Developers → Webhooks) pointing
   to `https://<region>-<project>.cloudfunctions.net/stripeWebhook`,
   listening for `checkout.session.completed`, with **"Listen to events
   on" set to "Your account"** (not "Connected accounts" — that's only
   for Stripe Connect marketplaces). Copy the **Signing secret**
   (`whsec_...`) and re-run:
   ```bash
   firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
   firebase deploy --only functions:stripeWebhook   # redeploy so it picks up the new secret version
   ```

## 3. Deploy Firestore rules + Functions

```bash
cd functions && npm install && cd ..
firebase deploy --only firestore:rules,functions
```

### Required one-time step: allow public invocation

New Cloud Functions default to requiring Google-authenticated callers —
but the browser (and Stripe's webhook) call these with no Google auth
at all, so **every function needs its Cloud Run invoker permission
opened to the public**, or you'll get CORS/403 errors that have nothing
to do with the `cors` option in the code. This isn't automatic and
isn't optional:

1. Go to [console.cloud.google.com/run](https://console.cloud.google.com/run?project=YOUR_PROJECT_ID)
2. For **each** service (`createcheckoutsession`, `trackengagement`,
   `tracksitevisit`, `trackhistoryclick`, `stripewebhook`): select it →
   **Permissions** → **Add Principal** → principal `allUsers`, role
   **Cloud Run Invoker** → Save (confirm the "this allows public
   access" prompt).
3. Repeat this for any *new* callable/HTTP function you add later —
   it does not carry over from existing functions.

## 4. Deploy the front-end

It's a regular Next.js app — works on any host (Vercel is the
simplest). Set the same `NEXT_PUBLIC_FIREBASE_*` env vars on the host,
point your domain at it, and you're done.

## Resetting billboard data

Useful before a real launch, to wipe out test claims:

```bash
firebase firestore:delete billboard/current --recursive --force
firebase firestore:delete billboard/current/history --recursive --force
firebase firestore:delete pendingClaims --recursive --force
firebase firestore:delete billboardPrivate/current --recursive --force
```

The site falls back to the empty default state automatically once
`billboard/current` doesn't exist.

## Going to production with real payments

Test mode never charges a real card. To accept real money:

1. Activate your Stripe account for live payments (Dashboard asks for
   business/bank details).
2. Switch to **Live mode**, grab the live secret key (`sk_live_...`).
3. Create a **separate live-mode webhook endpoint** (test and live
   webhooks are entirely separate in Stripe) pointing at the same
   `stripeWebhook` URL, grab its live signing secret.
4. `firebase functions:secrets:set STRIPE_SECRET_KEY` and
   `STRIPE_WEBHOOK_SECRET` again with the live values, then
   `firebase deploy --only functions`.
5. Double-check `SITE_URL` (see step 2.4 above) points at your real
   production domain, not `localhost`.

## Security notes

- All Cloud Functions validate input server-side and never trust a
  client-supplied price — see `functions/src/index.ts`.
- `linkUrl`/`imageUrl`/`iconUrl` are validated as public http(s) URLs
  (blocking localhost/private-network hosts) before being stored, to
  prevent SSRF via the dynamic OG image generation.
- The advertiser's email is kept in a separate `billboardPrivate/current`
  document with `allow read, write: if false` — never merged into the
  publicly-readable `billboard/current` doc.
- CORS on the callables is restricted to an origin allowlist
  (`functions/src/index.ts`), not left wide open.
- **Not yet done:** [Firebase App Check](https://firebase.google.com/docs/app-check)
  would meaningfully reduce scripted abuse of the public callables
  (fake claims, inflated click/view counts) beyond what origin-based
  CORS can — it requires configuring reCAPTCHA in the console, which
  wasn't set up as part of this build.

## Structure

```
src/
  app/                  # single route (page.tsx) + layout + globals.css
  components/
    scene/               # everything three.js: Billboard, Grass, Ground,
                          # VolumetricLight (fake light beams), Effects (bloom),
                          # CameraRig (constrained OrbitControls)
    ui/                  # InfoPanel (left), HistoryPanel (right),
                          # BottomBar (bottom-center CTA), ClaimModal
  hooks/                 # useBillboard / useBillboardHistory (onSnapshot)
  lib/
    firebase/            # client SDK + types
    stripe/checkout.ts    # calls the createCheckoutSession callable
    panelTexture.ts        # draws the current ad onto a canvas → 3D texture
    safeUrl.ts            # SSRF guard shared by /api/site-meta and the OG image route
functions/
  src/
    index.ts             # createCheckoutSession (onCall) + stripeWebhook + tracking callables
    pricing.ts             # the "always goes up" rule (next whole real)
    validation.ts           # server-side URL/length checks for claim input
    stripeClient.ts          # Stripe client + secrets
firestore.rules          # public read on billboard/*, everything else Admin-SDK-only
```

## About the 3D scene

The "light beams" coming off the base of the billboard
(`VolumetricLight.tsx`) are cones with additive blending and a radial
canvas gradient — they don't actually light anything, they just fake
fog/volumetrics and come alive through post-processing bloom
(`Effects.tsx`). The ad panel is drawn onto a `<canvas>`
(`lib/panelTexture.ts`) and turned into a `THREE.CanvasTexture`,
redrawn every time Firestore emits a new `billboard/current` — complete
with a little "pop" animation when the owner changes.
