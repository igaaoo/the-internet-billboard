// Mesma ideia do bloqueio de SSRF em src/app/api/site-meta/route.ts (app
// Next.js) — duplicado aqui porque functions/ é um pacote npm separado.
const BLOCKED_HOSTNAME_PATTERNS = [
  /^localhost$/i,
  /^0\.0\.0\.0$/,
  /^127\./,
  /^10\./,
  /^169\.254\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^\[?::1\]?$/,
  /^\[?f[cd]/i, // IPv6 unique local (fc00::/7)
  /^metadata\.google\.internal$/i,
];

/** true só pra URL http(s) válida e cujo host não aponta pra rede interna. */
export function isSafeHttpUrl(raw: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return false;
  }
  return !BLOCKED_HOSTNAME_PATTERNS.some((re) => re.test(parsed.hostname));
}
