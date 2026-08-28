export type BillboardDoc = {
  /** Nome da marca/pessoa anunciada, mostrado em destaque no painel. */
  brandName: string;
  /** Frase curta de apoio (opcional). */
  tagline?: string;
  /** URL para onde o painel leva ao ser clicado. */
  linkUrl?: string;
  /** Cor de fundo do painel (hex). */
  bgColor: string;
  /** Cor do texto do painel (hex). */
  textColor: string;
  /** URL de uma imagem/logo opcional (quadrada funciona melhor). */
  imageUrl?: string;
  /** Favicon do site do anunciante — puxado automático junto com o resto. */
  iconUrl?: string;
  /** Valor pago pelo dono atual, em centavos (USD). */
  priceCents: number;
  /** Próximo lance mínimo aceito, em centavos. Calculado no servidor. */
  minNextPriceCents: number;
  /** Quando este anúncio assumiu o billboard. */
  claimedAt?: { seconds: number; nanoseconds: number } | null;
  /** Quantas vezes o billboard já trocou de dono. */
  claimCount: number;
  /** Visitas e cliques do anúncio atual — zerados a cada troca de dono. */
  viewCount: number;
  clickCount: number;
};

export type HistoryEntry = Pick<
  BillboardDoc,
  | "brandName"
  | "bgColor"
  | "textColor"
  | "priceCents"
  | "iconUrl"
  | "linkUrl"
  | "viewCount"
  | "clickCount"
> & {
  id: string;
  claimedAt: { seconds: number; nanoseconds: number } | null;
};

export type ClaimDraft = {
  /**
   * brandName, tagline, imageUrl e iconUrl vêm automático dos metadados
   * do site (og:title/og:description/og:image/favicon) — a pessoa não
   * digita isso na mão, só cola o link. Ver /api/site-meta.
   */
  brandName: string;
  tagline: string;
  linkUrl: string;
  imageUrl: string;
  iconUrl: string;
  bgColor: string;
  textColor: string;
  email: string;
  priceCents: number;
  /** Gerado uma vez por tentativa de envio — vira a idempotency key da Stripe. */
  requestId: string;
};

export const DEFAULT_BILLBOARD: BillboardDoc = {
  brandName: "The Internet Billboard",
  tagline: "Be the first to claim it",
  bgColor: "#f2601a",
  textColor: "#fff6e8",
  priceCents: 0,
  minNextPriceCents: 100,
  claimCount: 0,
  claimedAt: null,
  viewCount: 0,
  clickCount: 0,
};
