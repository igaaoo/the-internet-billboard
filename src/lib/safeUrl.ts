import { promises as dns } from "node:dns";

// Compartilhado entre /api/site-meta e a geração da imagem OG — os dois
// fazem fetch de uma URL vinda de dado do anunciante, então os dois
// precisam do mesmo bloqueio de SSRF (rede interna/localhost).
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

export function isBlockedHostname(hostname: string): boolean {
  return BLOCKED_HOSTNAME_PATTERNS.some((re) => re.test(hostname));
}

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
  return !isBlockedHostname(parsed.hostname);
}

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return false;
  const [a, b] = parts;
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) ||
    (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31);
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  return lower === "::1" || lower.startsWith("fc") || lower.startsWith("fd") ||
    lower.startsWith("fe80");
}

/**
 * Igual `isSafeHttpUrl`, mas também resolve o DNS e confere o(s) IP(s)
 * de verdade — pega o caso de um domínio público que aponta pra um IP
 * interno, que o check só de hostname (acima) deixa passar. Não é uma
 * defesa completa contra DNS rebinding (o fetch em si resolve de novo,
 * podendo pegar outro IP entre o check e a conexão), mas cobre o caso comum.
 */
export async function isSafeRemoteUrl(raw: string): Promise<boolean> {
  if (!isSafeHttpUrl(raw)) return false;
  const hostname = new URL(raw).hostname;
  try {
    const results = await dns.lookup(hostname, { all: true });
    return results.every((r) =>
      r.family === 4 ? !isPrivateIPv4(r.address) : !isPrivateIPv6(r.address),
    );
  } catch {
    return false;
  }
}
