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

/** Extrai o content de uma meta tag, aceitando property/content em qualquer ordem. */
function extractMetaContent(html: string, key: string): string | null {
  const propFirst = new RegExp(
    `<meta[^>]+(?:property|name)=["']${key}["'][^>]*content=["']([^"']+)["']`,
    "i",
  );
  const contentFirst = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${key}["']`,
    "i",
  );
  const match = html.match(propFirst) ?? html.match(contentFirst);
  return match?.[1] ?? null;
}

/**
 * Busca a página (só o <head>, se der) e devolve a melhor imagem de
 * preview que achar: og:image:secure_url > og:image > twitter:image.
 */
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

  if (isBlockedHost(parsed.hostname)) {
    return NextResponse.json({ imageUrl: null });
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

    if (!res.ok) {
      return NextResponse.json({ imageUrl: null });
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) {
      return NextResponse.json({ imageUrl: null });
    }

    // le só um pedaço — og:image quase sempre está no <head>, não
    // precisa baixar a página inteira.
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

    const raw =
      extractMetaContent(html, "og:image:secure_url") ??
      extractMetaContent(html, "og:image") ??
      extractMetaContent(html, "twitter:image");

    const imageUrl = raw ? resolveUrl(res.url || parsed.toString(), raw) : null;

    return NextResponse.json(
      { imageUrl },
      { headers: { "cache-control": "public, max-age=3600" } },
    );
  } catch {
    return NextResponse.json({ imageUrl: null });
  } finally {
    clearTimeout(timeout);
  }
}
