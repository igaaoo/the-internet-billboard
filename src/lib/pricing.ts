/**
 * Mesma regra usada em functions/src/pricing.ts — duplicada aqui (app e
 * functions são pacotes npm separados) só pra calcular o próximo lance
 * mínimo no modo de prévia local, sem depender do backend.
 */
export const BASE_MIN_PRICE_CENTS = 2000; // R$ 20,00

export function computeMinNextPriceCents(currentPriceCents: number): number {
  if (!currentPriceCents || currentPriceCents <= 0) {
    return BASE_MIN_PRICE_CENTS;
  }
  return (Math.floor(currentPriceCents / 100) + 1) * 100;
}
