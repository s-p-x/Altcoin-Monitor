import { NextResponse } from "next/server";

export const runtime = "nodejs";

type CoinGeckoMarket = {
  id: string;
  symbol: string;
  name: string;
  market_cap_rank?: number;
  current_price?: number;
  market_cap?: number;
  total_volume?: number;
  price_change_percentage_24h?: number;
  image?: string;
};

// Simple in-memory cache (per serverless instance) to avoid repeated upstream calls
type CacheEntry = {
  data: CoinGeckoMarket[];
  expiresAt: number;
  meta: { totalFetched: number; pageCount: number; perPage: number };
};
const cache: Record<string, CacheEntry> = {};
const CACHE_TTL_MS = 150_000; // ~150s within 60-180 requirement

export async function GET(request: Request) {
  const urlObj = new URL(request.url);
  const perPageParam = urlObj.searchParams.get("perPage");
  const pageCountParam = urlObj.searchParams.get("pageCount");

  const perPage = Math.min(Math.max(parseInt(perPageParam || "250", 10) || 250, 50), 250);
  const pageCount = Math.min(Math.max(parseInt(pageCountParam || "2", 10) || 2, 1), 4);

  const cacheKey = `cg:markets:p${perPage}:c${pageCount}`;
  const now = Date.now();
  const cached = cache[cacheKey];
  if (cached && cached.expiresAt > now) {
    return NextResponse.json({ coins: cached.data, meta: cached.meta, cached: true });
  }

  const baseUrl = "https://api.coingecko.com/api/v3/coins/markets";

  // Limited concurrency (2) to be gentle to API
  const pageNumbers = Array.from({ length: pageCount }, (_, idx) => idx + 1);
  const results: CoinGeckoMarket[] = [];

  for (let i = 0; i < pageNumbers.length; i += 2) {
    const batch = pageNumbers.slice(i, i + 2);
    const batchResults = await Promise.all(
      batch.map(async (page) => {
        const params = new URLSearchParams({
          vs_currency: "usd",
          order: "market_cap_desc",
          per_page: String(perPage),
          page: String(page),
          sparkline: "false",
          price_change_percentage: "24h",
        });
        const url = `${baseUrl}?${params.toString()}`;
        const res = await fetch(url, {
          headers: { Accept: "application/json" },
          cache: "no-store",
        });

        if (!res.ok) {
          console.warn(`CoinGecko markets page ${page} failed:`, res.status, res.statusText);
          return [] as CoinGeckoMarket[];
        }

        const data: unknown = await res.json();
        const items = Array.isArray(data) ? data : [];
        if (process.env.NODE_ENV === "development") {
          console.log(`Fetched CoinGecko markets page ${page}: ${items.length}`);
        }
        return items.filter((item): item is CoinGeckoMarket => {
          return (
            typeof item === "object" &&
            item !== null &&
            typeof (item as { id?: unknown }).id === "string" &&
            typeof (item as { symbol?: unknown }).symbol === "string" &&
            typeof (item as { name?: unknown }).name === "string"
          );
        });
      })
    );
    for (const arr of batchResults) results.push(...arr);
  }

  // Dedupe by id (preferred) else symbol
  const seen = new Set<string>();
  const merged = results.filter((coin) => {
    const key = coin.id || (coin.symbol || "").toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (process.env.NODE_ENV === "development") {
    console.log(`Merged CoinGecko markets: ${merged.length} (pages=${pageCount}, perPage=${perPage})`);
  }

  const meta = { totalFetched: merged.length, pageCount, perPage };

  cache[cacheKey] = { data: merged, meta, expiresAt: now + CACHE_TTL_MS };

  return NextResponse.json({ coins: merged, meta, cached: false });
}
