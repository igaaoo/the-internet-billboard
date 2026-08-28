export type ClaimDraft = {
  brandName: string;
  tagline?: string;
  linkUrl?: string;
  bgColor: string;
  textColor: string;
  imageUrl?: string;
  iconUrl?: string;
  email: string;
  priceCents: number;
  requestId?: string;
};

export type BillboardDoc = {
  brandName: string;
  tagline?: string;
  linkUrl?: string;
  bgColor: string;
  textColor: string;
  imageUrl?: string;
  iconUrl?: string;
  priceCents: number;
  minNextPriceCents: number;
  claimedAt: FirebaseFirestore.FieldValue | FirebaseFirestore.Timestamp | null;
  claimCount: number;
  /** Visitas e cliques do anúncio atual — zerados a cada troca de dono. */
  viewCount: number;
  clickCount: number;
};
