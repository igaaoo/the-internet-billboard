import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const BLOCKED_HOSTNAME_PATTERNS = [
  /^localhost$/i,
  /^0\.0\.0\.0$/,
  /^127\./,
  /^10\./,
  /^169\.254\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^\[?::1\]?$/,
  /^\[?fc/i, // IPv6 unique local
];

function isBlockedHost(hostname: string) {
  return BLOCKED_HOSTNAME_PATTERNS.some((re) => re.test(hostname));
}

function resolveUrl(base: string, maybeRelative: string): string | null {
  try {
    return new URL(maybeRelative, base).toString();
  } catch {
    return null;
  }
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

/** Extrai o content de uma <meta>, aceitando property/content em qualquer ordem. */
function extractMeta(html: string, key: string): string | null {
  const propFirst = new RegExp(
    `<meta[^>]+(?:property|name)=["']${key}["'][^>]*content=["']([^"']*)["']`,
    "i",
  );
  const contentFirst = new RegExp(
    `<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${key}["']`,
    "i",
  );
  const match = html.match(propFirst) ?? html.match(contentFirst);
  return match?.[1] ? decodeEntities(match[1]) : null;
}

function extractTitleTag(html: string): string | null {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return match?.[1] ? decodeEntities(match[1]) : null;
}

/** Pega o primeiro <link rel="icon|shortcut icon|apple-touch-icon"> que achar. */
function extractIcon(html: string): string | null {
  const linkTagRe = /<link[^>]+>/gi;
  const tags = html.match(linkTagRe) ?? [];
  let best: { href: string; score: number } | null = null;

  for (const tag of tags) {
    const relMatch = tag.match(/rel=["']([^"']+)["']/i);
    const hrefMatch = tag.match(/href=["']([^"']+)["']/i);
    if (!relMatch || !hrefMatch) continue;
    const rel = relMatch[1].toLowerCase();
    if (!rel.includes("icon")) continue;

    const score = rel.includes("apple-touch-icon") ? 2 : rel.includes("icon") ? 1 : 0;
    if (!best || score > best.score) {
      best = { href: hrefMatch[1], score };
    }
  }

  return best?.href ?? null;
}

export async function GET(req: NextRequest) {
  const target = req.nextUrl.searchParams.get("url");
  if (!target) {
    return NextResponse.json({ error: "missing url" }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(target);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("bad protocol");
    }
  } catch {
    return NextResponse.json({ error: "invalid url" }, { status: 400 });
  }

  const empty = { title: null, description: null, imageUrl: null, iconUrl: null };

  if (isBlockedHost(parsed.hostname)) {
    return NextResponse.json(empty);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);

  try {
    const res = await fetch(parsed.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "user-agent":
          "Mozilla/5.0 (compatible; TheInternetBillboardBot/1.0; +https://theinternetbillboard.lol)",
        accept: "text/html,application/xhtml+xml",
      },
    });

    if (!res.ok) return NextResponse.json(empty);

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) return NextResponse.json(empty);

    // lê só um pedaço — tudo que a gente quer normalmente está no <head>.
    let html = "";
    const reader = res.body?.getReader();
    if (reader) {
      const decoder = new TextDecoder();
      let bytes = 0;
      while (bytes < 250_000) {
        const { done, value } = await reader.read();
        if (done) break;
        html += decoder.decode(value, { stream: true });
        bytes += value.byteLength;
        if (/<\/head>/i.test(html)) break;
      }
      await reader.cancel().catch(() => {});
    } else {
      html = await res.text();
    }

    const finalUrl = res.url || parsed.toString();

    const title =
      extractMeta(html, "og:site_name") ??
      extractMeta(html, "og:title") ??
      extractTitleTag(html) ??
      parsed.hostname.replace(/^www\./, "");

    const description =
      extractMeta(html, "og:description") ?? extractMeta(html, "description");

    const rawImage =
      extractMeta(html, "og:image:secure_url") ??
      extractMeta(html, "og:image") ??
      extractMeta(html, "twitter:image");
    const imageUrl = rawImage ? resolveUrl(finalUrl, rawImage) : null;

    const rawIcon = extractIcon(html) ?? "/favicon.ico";
    const iconUrl = resolveUrl(finalUrl, rawIcon);

    return NextResponse.json(
      { title, description, imageUrl, iconUrl },
      { headers: { "cache-control": "public, max-age=3600" } },
    );
  } catch {
    return NextResponse.json(empty);
  } finally {
    clearTimeout(timeout);
  }
}
