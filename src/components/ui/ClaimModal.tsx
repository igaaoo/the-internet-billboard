"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { BillboardDoc, ClaimDraft } from "@/lib/firebase/types";
import { formatUSD } from "@/lib/format";
import { requestBillboardCheckout } from "@/lib/stripe/checkout";
import { isFirebaseConfigured } from "@/lib/firebase/client";
import { computeMinNextPriceCents } from "@/lib/pricing";

type SiteMeta = {
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  iconUrl: string | null;
};

// Painel sempre com a cara laranja/cozy do site, independente do
// anunciante — não é escolha de quem tá comprando, é a identidade do
// billboard. Se um dia quisermos variar, dá pra puxar da imagem do site.
const PANEL_BG = "#f2601a";
const PANEL_TEXT = "#fff6e8";

/** Aceita "seusite.com" e transforma em "https://seusite.com". */
function normalizeLink(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function hostnameOf(url: string): string {
  try {
    return new URL(normalizeLink(url)).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function ClaimModal({
  billboard,
  onClose,
  onPreview,
}: {
  billboard: BillboardDoc;
  onClose: () => void;
  /**
   * Chamado no lugar do checkout quando o Firebase ainda não está
   * configurado — deixa testar como o anúncio fica no billboard sem
   * precisar de pagamento de verdade.
   */
  onPreview: (doc: BillboardDoc) => void;
}) {
  const minDollars = String(Math.round(billboard.minNextPriceCents / 100));
  const previewMode = !isFirebaseConfigured;

  const [linkUrl, setLinkUrl] = useState("");
  const [email, setEmail] = useState("");
  const [priceDollars, setPriceDollars] = useState(minDollars);

  const [meta, setMeta] = useState<SiteMeta | null>(null);
  // true desde o instante em que a pessoa termina de colar o link até o
  // fetch de fato resolver — cobre tanto o debounce quanto a requisição,
  // pra não deixar enviar o formulário com a busca ainda pendente.
  const [metaPending, setMetaPending] = useState(false);
  const [metaTried, setMetaTried] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Busca automática: nada de digitar nome/frase/imagem na mão — a gente
  // puxa tudo (og:title, og:description, og:image, favicon) do link que
  // a pessoa colar, com um debounce curto pra não disparar a cada tecla.
  useEffect(() => {
    const trimmed = linkUrl.trim();
    if (!trimmed) {
      // reset síncrono e intencional: campo esvaziado, não há mais o que buscar.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMeta(null);
      setMetaTried(false);
      setMetaPending(false);
      return;
    }

    let parsed: URL;
    try {
      parsed = new URL(normalizeLink(trimmed));
    } catch {
      setMetaPending(false);
      return;
    }

    setMetaPending(true);
    setMetaTried(false);
    let cancelled = false;

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/site-meta?url=${encodeURIComponent(parsed.toString())}`,
        );
        const data = (await res.json()) as SiteMeta;
        if (cancelled) return;
        setMeta(data);
      } catch {
        if (!cancelled) setMeta(null);
      } finally {
        if (!cancelled) {
          setMetaPending(false);
          setMetaTried(true);
        }
      }
    }, 650);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [linkUrl]);

  const priceCents = Math.round(parseInt(priceDollars || "0", 10)) * 100;
  const priceTooLow =
    Number.isFinite(priceCents) && priceCents < billboard.minNextPriceCents;

  const resolvedBrandName = meta?.title?.trim() || hostnameOf(linkUrl);
  const canSubmit =
    Boolean(linkUrl.trim()) && Boolean(resolvedBrandName) && !metaPending;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!linkUrl.trim() || !resolvedBrandName) {
      setError("Paste your website link — we'll pull the details from there.");
      return;
    }
    if (metaPending) {
      setError("Hold on, still fetching your site's info.");
      return;
    }
    if (priceTooLow || !priceCents) {
      setError(
        `Your bid must be at least ${formatUSD(billboard.minNextPriceCents)}.`,
      );
      return;
    }

    const claim: Omit<ClaimDraft, "priceCents"> = {
      brandName: resolvedBrandName,
      tagline: meta?.description?.trim() ?? "",
      linkUrl: normalizeLink(linkUrl),
      imageUrl: meta?.imageUrl ?? "",
      iconUrl: meta?.iconUrl ?? "",
      bgColor: PANEL_BG,
      textColor: PANEL_TEXT,
      email,
      // uma por tentativa de envio — a Cloud Function usa isso como
      // idempotency key da Stripe, pra um retry de rede não duplicar a cobrança.
      requestId: crypto.randomUUID(),
    };

    if (previewMode) {
      // sem Firebase/Stripe configurados ainda: só mostra a prévia local,
      // sem cobrar nem persistir nada em lugar nenhum.
      const previewDoc: BillboardDoc = {
        ...claim,
        priceCents,
        minNextPriceCents: computeMinNextPriceCents(priceCents),
        claimCount: (billboard.claimCount ?? 0) + 1,
        claimedAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
        viewCount: 0,
        clickCount: 0,
      };
      onPreview(previewDoc);
      onClose();
      return;
    }

    if (!email.trim()) {
      setError("We need your email to confirm payment.");
      return;
    }

    setSubmitting(true);
    try {
      const url = await requestBillboardCheckout({ ...claim, priceCents });
      window.location.href = url;
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Couldn't start payment. Try again in a moment.",
      );
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="glass-panel w-full max-w-md rounded-3xl p-6 sm:p-7 flex flex-col gap-4 max-h-[88vh] overflow-y-auto"
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-display text-2xl text-ink-900">
              Claim the billboard
            </h2>
            <p className="text-sm text-ink-500 mt-1">
              minimum bid now:{" "}
              <span className="text-orange-600 font-semibold">
                {formatUSD(billboard.minNextPriceCents)}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-ink-500 hover:text-ink-900 text-xl leading-none px-1 cursor-pointer"
          >
            ×
          </button>
        </div>

        {previewMode && (
          <p className="text-xs text-orange-700 bg-orange-300/25 rounded-lg px-3 py-2 leading-relaxed">
            Local preview — Firebase/Stripe not configured yet, so this just
            shows how your ad looks on the 3D billboard. No one else sees this,
            and nothing is charged.
          </p>
        )}

        <Field label="Your website">
          <input
            required
            type="text"
            inputMode="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="yoursite.com"
            className="input"
          />
          <p className="text-[11px] text-ink-500 mt-1">
            We&apos;ll pull the name, tagline, and image directly from your site
          </p>
        </Field>

        <SitePreview
          linkUrl={linkUrl}
          meta={meta}
          pending={metaPending}
          tried={metaTried}
        />

        {!previewMode && (
          <Field label="Your email">
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              className="input"
            />
          </Field>
        )}

        <Field
          label={`How much to bid (min. ${formatUSD(billboard.minNextPriceCents)})`}
        >
          <div className="input flex items-center gap-1.5">
            <span className="text-ink-500 text-sm shrink-0">$</span>
            <input
              required
              type="number"
              min={minDollars}
              step="1"
              inputMode="numeric"
              value={priceDollars}
              onChange={(e) => setPriceDollars(e.target.value.replace(/[^\d]/g, ""))}
              className="flex-1 min-w-0 bg-transparent outline-none border-none p-0 text-sm text-ink-900"
            />
          </div>
        </Field>

        {error && (
          <p className="text-sm text-orange-700 bg-orange-300/25 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting || !canSubmit}
          className="btn-cta rounded-full py-3 text-sm font-semibold mt-1 disabled:opacity-60 cursor-pointer"
        >
          {submitting
            ? "opening payment…"
            : metaPending
              ? "fetching site info…"
              : previewMode
                ? "preview on billboard →"
                : "go to payment →"}
        </button>

        <style jsx>{`
          .input {
            width: 100%;
            border-radius: 0.75rem;
            border: 1px solid
              color-mix(in oklab, var(--color-tan-400) 55%, transparent);
            background: color-mix(in oklab, white 55%, transparent);
            padding: 0.55rem 0.75rem;
            font-size: 0.875rem;
            color: var(--color-ink-900);
            outline: none;
          }
          .input:focus,
          .input:focus-within {
            border-color: var(--color-orange-500);
          }
        `}</style>
      </form>
    </div>
  );
}

function SitePreview({
  linkUrl,
  meta,
  pending,
  tried,
}: {
  linkUrl: string;
  meta: SiteMeta | null;
  pending: boolean;
  tried: boolean;
}) {
  if (!linkUrl.trim()) return null;

  if (pending) {
    return (
      <div className="rounded-xl border border-tan-400/40 bg-white/40 px-3 py-3 text-xs text-ink-500 animate-pulse-soft">
        fetching your site info…
      </div>
    );
  }

  const title = meta?.title?.trim() || hostnameOf(linkUrl);
  const noMetaFound =
    tried && !meta?.title && !meta?.description && !meta?.imageUrl;

  return (
    <div className="rounded-xl border border-tan-400/40 bg-white/40 px-3 py-3 flex gap-3 items-center">
      {meta?.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={meta.imageUrl}
          alt=""
          className="h-12 w-12 rounded-lg object-cover border border-tan-400/40 shrink-0 bg-white"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      ) : (
        meta?.iconUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={meta.iconUrl}
            alt=""
            className="h-8 w-8 rounded shrink-0"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        )
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink-900 truncate">
          {title || "…"}
        </p>
        {meta?.description && (
          <p className="text-xs text-ink-500 truncate">{meta.description}</p>
        )}
        {noMetaFound && (
          <p className="text-xs text-ink-500">
            couldn't find og:title/og:description/og:image on that link —
            we'll just use the domain name instead.
          </p>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-ink-700">{label}</span>
      {children}
    </label>
  );
}
