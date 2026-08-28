# The Internet Billboard

Um único billboard 3D (Next.js + Three.js) onde quem paga mais assume o
anúncio — até o próximo lance. Pagamentos via Stripe, dados em Firestore,
lógica sensível (validação de preço, checkout, webhook) em Cloud Functions.

## Stack

- **Front-end:** Next.js 16 (App Router) + TypeScript + Tailwind v4
- **3D:** three.js via `@react-three/fiber`, `@react-three/drei` e
  `@react-three/postprocessing` (bloom, vinheta, grão)
- **Dados:** Firebase Firestore (`billboard/current` + `billboard/current/history`)
- **Pagamentos:** Stripe Checkout, criado e confirmado via Firebase Functions
  (`createCheckoutSession` callable + `stripeWebhook`)

## Como funciona a "disputa"

Não existe leilão com tempo — o preço só sobe. Cada novo anúncio precisa
pagar pelo menos 10% a mais (ou +R$5, o que for maior) que o valor pago
pelo dono atual. Essa regra vive em `functions/src/pricing.ts` e é
validada **duas vezes no servidor**: na criação do checkout e de novo,
dentro de uma transação, quando o webhook do Stripe confirma o pagamento
(pra cobrir a corrida de dois pagamentos simultâneos).

## Rodando localmente

```bash
npm install
cp .env.local.example .env.local   # preencha depois de criar o projeto Firebase
npm run dev
```

O site funciona mesmo **sem** as variáveis do Firebase preenchidas — ele
cai num billboard "vazio" de demonstração pra você ver a cena 3D e a UI.
O botão "Assumir o billboard" só funciona de verdade depois do passo 2.

## 1. Criar o projeto Firebase

1. Crie um projeto em https://console.firebase.google.com
2. Ative o **Firestore** (modo produção, escolha uma região próxima do
   Brasil, ex. `southamerica-east1`)
3. Em *Configurações do projeto → Geral*, adicione um **app Web** e copie
   as chaves pro seu `.env.local` (veja `.env.local.example`)
4. Edite `.firebaserc` e troque `COLOQUE-AQUI-O-ID-DO-SEU-PROJETO-FIREBASE`
   pelo Project ID real
5. Instale a CLI (`npm i -g firebase-tools`), rode `firebase login` e
   depois `firebase deploy --only firestore:rules`

## 2. Criar a conta Stripe

1. Crie uma conta em https://dashboard.stripe.com (o modo de teste já
   serve pra desenvolver)
2. Pegue a **Secret key** (`sk_test_...`)
3. Configure os secrets das Functions (produção, via Secret Manager):
   ```bash
   firebase functions:secrets:set STRIPE_SECRET_KEY
   ```
4. Depois de fazer o primeiro deploy das functions, crie um **webhook
   endpoint** no Stripe apontando pra:
   `https://<sua-região>-<seu-projeto>.cloudfunctions.net/stripeWebhook`
   escutando o evento `checkout.session.completed`, copie o **Signing
   secret** (`whsec_...`) e rode:
   ```bash
   firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
   ```
5. Ajuste o parâmetro `SITE_URL` (usado nos redirects de sucesso/cancelamento)
   no `firebase.json` ou via `.env` — veja `functions/.env.example` pro
   emulador local.

## 3. Deploy das Functions

```bash
cd functions
npm install
npm run build
firebase deploy --only functions
```

## 4. Deploy do front-end

O app é um Next.js normal — funciona em qualquer host (Vercel é o mais
simples). Configure as mesmas variáveis `NEXT_PUBLIC_FIREBASE_*` nas
env vars do host, aponte o domínio `theinternetbillboard.lol` pra lá, e
pronto.

## Estrutura

```
src/
  app/                  # rota única (page.tsx) + layout + globals.css
  components/
    scene/               # tudo do three.js: Billboard, Grass, Ground,
                          # VolumetricLight (feixes falsos), Effects (bloom),
                          # CameraRig (OrbitControls restrito)
    ui/                  # InfoPanel (esquerda), HistoryPanel (direita),
                          # BottomBar (CTA central embaixo), ClaimModal
  hooks/                 # useBillboard / useBillboardHistory (onSnapshot)
  lib/
    firebase/            # client SDK + tipos
    stripe/checkout.ts    # chama a callable createCheckoutSession
    panelTexture.ts        # desenha o anúncio atual num canvas → textura 3D
functions/
  src/
    index.ts             # createCheckoutSession (onCall) + stripeWebhook
    pricing.ts             # regra do "sempre sobe" (10% ou +R$5)
    stripeClient.ts          # client Stripe + secrets
firestore.rules          # leitura pública, escrita só via Admin SDK
```

## Sobre a cena 3D

As "luzinhas" que saem da base do billboard (`VolumetricLight.tsx`) são
cones com blending aditivo e um gradiente radial em canvas — não
iluminam nada de verdade, só simulam neblina/volumetria e ganham vida com
o bloom do post-processing (`Effects.tsx`). O painel do anúncio é
desenhado num `<canvas>` (`lib/panelTexture.ts`) e vira uma
`THREE.CanvasTexture`, redesenhada toda vez que o Firestore emite um novo
`billboard/current` — inclusive com uma animaçãozinha de "pop" na troca
de dono.
