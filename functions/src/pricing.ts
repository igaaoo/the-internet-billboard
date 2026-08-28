/**
 * Lance mínimo: o próximo real inteiro acima do valor atual — sem
 * percentual, sem centavos. Um billboard vazio conta como $0, então o
 * primeiro lance mínimo é $1.
 */
export function computeMinNextPriceCents(currentPriceCents: number): number {
  const base =
    Number.isFinite(currentPriceCents) && currentPriceCents > 0
      ? currentPriceCents
      : 0;
  return (Math.floor(base / 100) + 1) * 100;
}
