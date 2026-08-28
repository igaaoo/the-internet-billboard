"use client";

const STEPS = [
  { n: "01", label: "Você manda seu anúncio", detail: "marca, cor e um link" },
  { n: "02", label: "Paga mais que o valor atual", detail: "via Stripe, super rápido" },
  { n: "03", label: "Assume o billboard", detail: "até alguém pagar mais que você" },
];

export function InfoPanel() {
  return (
    <aside className="pointer-events-auto hidden md:flex flex-col gap-5 w-[280px] glass-panel rounded-3xl p-6 animate-fade-up">
      <div className="flex items-center gap-2.5">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500 text-cream-50 text-lg shadow-sm">
          🔶
        </span>
        <div>
          <p className="font-display text-lg leading-none text-ink-900">
            the internet billboard
          </p>
          <p className="text-[11px] uppercase tracking-wider text-ink-500 mt-1">
            um outdoor pra internet toda
          </p>
        </div>
      </div>

      <p className="text-sm leading-relaxed text-ink-700">
        Existe só um billboard. Quem pagar mais que o dono atual, assume o
        painel e divulga o que quiser — até o próximo lance.
      </p>

      <div className="h-px bg-tan-400/40" />

      <ol className="flex flex-col gap-3.5">
        {STEPS.map((s) => (
          <li key={s.n} className="flex gap-3 items-start">
            <span className="font-display text-orange-500 text-sm mt-0.5 shrink-0">
              {s.n}
            </span>
            <div>
              <p className="text-sm font-semibold text-ink-900 leading-tight">
                {s.label}
              </p>
              <p className="text-xs text-ink-500 mt-0.5">{s.detail}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="h-px bg-tan-400/40" />

      <p className="text-[11px] text-ink-500 leading-relaxed">
        Pagamentos processados via Stripe. Nenhum dado de cartão passa pelos
        nossos servidores.
      </p>
    </aside>
  );
}
