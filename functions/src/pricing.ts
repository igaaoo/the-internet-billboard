/** Preço inicial (em centavos) quando o billboard ainda não teve dono. */
export const BASE_MIN_PRICE_CENTS = 2000; // R$ 20,00

/** Lance mínimo: o próximo real inteiro acima do valor atual — sem percentual, sem centavos. */
export function computeMinNextPriceCents(currentPriceCents: number): number {
  if (!currentPriceCents || currentPriceCents <= 0) {
    return BASE_MIN_PRICE_CENTS;
  }
  return (Math.floor(currentPriceCents / 100) + 1) * 100;
}
