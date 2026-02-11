"use client";

import { useEffect, useMemo } from "react";

export type CoinSummary = {
  id: string;
  symbol: string;
  name: string;
  price?: number | null;
  marketCap?: number | null;
  totalVolume?: number | null;
  priceChange24hPct?: number | null;
  image?: string | null;
};

type Props = {
  open: boolean;
  coin: CoinSummary | null;
  onClose: () => void;
};

type Series = { name: string; values: number[]; stroke?: string };

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

function formatCompact(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  try {
    return Intl.NumberFormat(undefined, {
      notation: "compact",
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return String(value);
  }
}

function formatPrice(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const abs = Math.abs(value);
  const digits = abs >= 100 ? 2 : abs >= 1 ? 4 : 6;
  return Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: digits,
  }).format(value);
}

function seededRandom(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeMockSeries(seed: string, length: number, base: number, volatility: number) {
  const rand = seededRandom(seed);
  const values: number[] = [];
  let v = base;
  for (let i = 0; i < length; i++) {
    const shock = (rand() - 0.5) * volatility;
    v = Math.max(0.000001, v * (1 + shock));
    values.push(v);
  }
  return values;
}

function LineChart({ series, height = 90 }: { series: Series[]; height?: number }) {
  const allValues = series.flatMap((s) => s.values);
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const range = max - min || 1;
  const width = 400;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      role="img"
      aria-label="Line chart"
    >
      <path
        d={`M 0 ${height - 1} H ${width}`}
        stroke="var(--border)"
        strokeWidth="1"
        fill="none"
        opacity={0.7}
      />
      {series.map((s, idx) => {
        const pts = s.values
          .map((v, i) => {
            const x = (i / Math.max(1, s.values.length - 1)) * width;
            const y = height - clamp01((v - min) / range) * (height - 4) - 2;
            return `${x.toFixed(2)},${y.toFixed(2)}`;
          })
          .join(" ");

        return (
          <polyline
            key={`${s.name}-${idx}`}
            points={pts}
            fill="none"
            stroke={s.stroke || "var(--accent)"}
            strokeWidth={2}
            opacity={idx === 0 ? 1 : 0.85}
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
    </svg>
  );
}

function BarChart({ values, height = 90 }: { values: number[]; height?: number }) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const width = 400;
  const barW = width / Math.max(1, values.length);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      role="img"
      aria-label="Bar chart"
    >
      <path
        d={`M 0 ${height - 1} H ${width}`}
        stroke="var(--border)"
        strokeWidth="1"
        fill="none"
        opacity={0.7}
      />
      {values.map((v, i) => {
        const h = clamp01((v - min) / range) * (height - 6);
        const x = i * barW + 1;
        const y = height - h - 2;
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={Math.max(1, barW - 2)}
            height={h}
            fill="var(--accent)"
            opacity={0.35}
          />
        );
      })}
    </svg>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[var(--panel)] rounded-lg border border-[var(--border)] p-3">
      <div className="text-xs font-semibold text-[var(--text)] mb-2">{title}</div>
      {children}
    </div>
  );
}

export default function CoinClickPanel({ open, coin, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const mock = useMemo(() => {
    if (!coin) return null;
    const seed = `${coin.id}:${coin.symbol}`;
    const basePrice = coin.price && coin.price > 0 ? coin.price : 1 + seededRandom(seed)() * 50;
    const baseVol = coin.totalVolume && coin.totalVolume > 0 ? coin.totalVolume : 5_000_000 + seededRandom(seed + ":v")() * 40_000_000;

    const price = makeMockSeries(seed + ":price", 72, basePrice, 0.03);
    const volumeLine = makeMockSeries(seed + ":volLine", 72, baseVol, 0.08);
    const volumeBars = makeMockSeries(seed + ":volBars", 48, baseVol * 0.7, 0.12);

    const spot = makeMockSeries(seed + ":spot", 72, baseVol * 0.55, 0.06);
    const perp = makeMockSeries(seed + ":perp", 72, baseVol * 0.45, 0.06);

    const wrapped = makeMockSeries(seed + ":wrapped", 72, baseVol * 0.35, 0.05);
    const native = makeMockSeries(seed + ":native", 72, baseVol * 0.65, 0.05);

    const volMcap = makeMockSeries(seed + ":vm", 72, 0.08, 0.06).map((x) => Math.min(0.6, x));
    const multiple = makeMockSeries(seed + ":mult", 72, 1.2, 0.08).map((x) => Math.max(0.2, Math.min(5, x)));
    const exchShare = makeMockSeries(seed + ":exch", 72, 0.22, 0.12).map((x) => Math.max(0.01, Math.min(0.9, x)));

    return {
      price,
      volumeLine,
      volumeBars,
      spot,
      perp,
      wrapped,
      native,
      volMcap,
      multiple,
      exchShare,
    };
  }, [coin]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-[var(--bg)]/60"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        className="absolute right-0 top-0 h-full w-full max-w-6xl bg-[var(--bg)] border-l border-[var(--border)]"
      >
        <div className="h-full overflow-y-auto">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] bg-[var(--panel)]">
            <div className="flex items-center gap-3">
              {coin?.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={coin.image} alt={coin.name} className="w-7 h-7 rounded-full" />
              ) : null}
              <div>
                <div className="text-lg font-semibold text-[var(--text)]">
                  ${coin?.symbol?.toUpperCase() || "—"}
                </div>
                <div className="text-xs text-[var(--text-muted)]">{coin?.name || ""}</div>
              </div>
            </div>

            <button
              type="button"
              className="px-3 py-2 text-xs border border-[var(--border)] bg-[var(--panel)] text-[var(--text-muted)] rounded-md hover:text-[var(--text)]"
              onClick={onClose}
            >
              Close
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-5">
            {/* LEFT column */}
            <div className="space-y-4">
              <div className="bg-[var(--panel)] rounded-lg border border-[var(--border)] p-4">
                <div className="grid grid-cols-2 gap-y-2 text-sm">
                  <div className="text-[var(--text-muted)]">Price</div>
                  <div className="text-right tabular-nums">{formatPrice(coin?.price)}</div>

                  <div className="text-[var(--text-muted)]">Market Cap</div>
                  <div className="text-right tabular-nums">{formatCompact(coin?.marketCap)}</div>

                  <div className="text-[var(--text-muted)]">24h Volume</div>
                  <div className="text-right tabular-nums">{formatCompact(coin?.totalVolume)}</div>

                  <div className="text-[var(--text-muted)]">24h %</div>
                  <div
                    className="text-right tabular-nums"
                    style={{
                      color:
                        (coin?.priceChange24hPct || 0) >= 0
                          ? "var(--semantic-green)"
                          : "var(--semantic-red)",
                    }}
                  >
                    {(coin?.priceChange24hPct ?? 0).toFixed(2)}%
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <ChartCard title="Price (line)">
                  <LineChart series={[{ name: "Price", values: mock?.price || [] }]} height={110} />
                </ChartCard>

                <ChartCard title="Volume (line)">
                  <LineChart
                    series={[{ name: "Volume", values: mock?.volumeLine || [], stroke: "var(--text-muted)" }]}
                    height={90}
                  />
                </ChartCard>

                <ChartCard title="Volume (bars)">
                  <BarChart values={mock?.volumeBars || []} height={90} />
                </ChartCard>
              </div>
            </div>

            {/* RIGHT column */}
            <div className="space-y-3">
              <ChartCard title="Spot vs Perp volume">
                <LineChart
                  series={[
                    { name: "Spot", values: mock?.spot || [], stroke: "var(--accent)" },
                    { name: "Perp", values: mock?.perp || [], stroke: "var(--text-muted)" },
                  ]}
                  height={100}
                />
              </ChartCard>

              <ChartCard title="Wrapped vs Native volume">
                <LineChart
                  series={[
                    { name: "Wrapped", values: mock?.wrapped || [], stroke: "var(--accent)" },
                    { name: "Native", values: mock?.native || [], stroke: "var(--text-muted)" },
                  ]}
                  height={100}
                />
              </ChartCard>

              <ChartCard title="Vol/MCap over time">
                <LineChart
                  series={[{ name: "Vol/MCap", values: mock?.volMcap || [], stroke: "var(--accent)" }]}
                  height={95}
                />
              </ChartCard>

              <ChartCard title="Volume vs baseline multiple">
                <LineChart
                  series={[{ name: "Multiple", values: mock?.multiple || [], stroke: "var(--accent)" }]}
                  height={95}
                />
              </ChartCard>

              <ChartCard title="Exchange share over time">
                <LineChart
                  series={[{ name: "Share", values: mock?.exchShare || [], stroke: "var(--accent)" }]}
                  height={95}
                />
              </ChartCard>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
