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
2. Enable **Firestore** (production mode, pick a region close to your
   users, e.g. `southamerica-east1`)
3. Under *Project settings → General*, add a **Web app** and copy the
   config into your `.env.local` (see `.env.local.example`)
4. Edit `.firebaserc` and replace `COLOQUE-AQUI-O-ID-DO-SEU-PROJETO-FIREBASE`
   with your real Project ID
5. Install the CLI (`npm i -g firebase-tools`), run `firebase login`,
   then `firebase deploy --only firestore:rules`

## 2. Create the Stripe account

1. Create an account at https://dashboard.stripe.com (test mode is
   enough for development)
2. Grab the **Secret key** (`sk_test_...`)
3. Set the Functions secrets (production, via Secret Manager):
   ```bash
   firebase functions:secrets:set STRIPE_SECRET_KEY
   ```
4. After the first Functions deploy, create a **webhook endpoint** in
   Stripe pointing to:
   `https://<your-region>-<your-project>.cloudfunctions.net/stripeWebhook`
   listening for the `checkout.session.completed` event, copy the
   **Signing secret** (`whsec_...`) and run:
   ```bash
   firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
   ```
5. Set the `SITE_URL` param (used for the success/cancel redirects) via
   a `functions/.env.<project-id>` file — see `functions/.env.example`
   for the local emulator.

## 3. Deploy the Functions

```bash
cd functions
npm install
npm run build
firebase deploy --only functions
```

## 4. Deploy the front-end

It's a regular Next.js app — works on any host (Vercel is the
simplest). Set the same `NEXT_PUBLIC_FIREBASE_*` env vars on the host,
point your domain at it, and you're done.

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
functions/
  src/
    index.ts             # createCheckoutSession (onCall) + stripeWebhook
    pricing.ts             # the "always goes up" rule (next whole real)
    stripeClient.ts          # Stripe client + secrets
firestore.rules          # public read, write only via Admin SDK
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
