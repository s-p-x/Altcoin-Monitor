/**
 * Universe Service - Manages the merged coin universe
 * 
 * Sources:
 * 1. Top N coins by market cap from CoinGecko
 * 2. Exchange symbols (Binance spot/perps)
 * 3. User-added symbols (per user, from DB)
 * 
 * Caches merged universe server-side for 2 minutes
 */

import NodeCache from "node-cache";

interface Coin {
  id: string; // stable internal id (usually provider id)
  baseSymbol: string; // e.g., "BTC"
  pairSymbol?: string; // e.g., "BTCUSDT" if applicable
  name: string;
  marketCap?: number;
  volume24h?: number;
  volMcapPct?: number; // volume24h / marketCap * 100
  source: "coingecko" | "exchange" | "user";
}

// Server-side cache (2 minutes)
const universeCache = new NodeCache({ stdTTL: 120, checkperiod: 60 });

// Common exchange symbols that are tracked in the app
const COMMON_EXCHANGE_SYMBOLS = [
  "BTC",
  "ETH",
  "BNB",
  "SOL",
  "XRP",
  "ADA",
  "DOGE",
  "AVAX",
  "SHIB",
  "MATIC",
  "LINK",
  "DOT",
  "LTC",
  "BCH",
  "XLM",
  "UNI",
  "AAVE",
  "ATOM",
  "ARB",
  "OP",
];

/**
 * Normalize a coin to internal format
 */
function normalizeCoin(coin: any, source: "coingecko" | "exchange" | "user"): Coin {
  const baseSymbol = String(coin.symbol || coin.baseSymbol || "").toUpperCase();
  const pairSymbol = coin.pairSymbol
    ? String(coin.pairSymbol).toUpperCase()
    : undefined;

  return {
    id: coin.id || `${source}:${baseSymbol}`,
    baseSymbol,
    pairSymbol,
    name: coin.name || baseSymbol,
    marketCap: typeof coin.marketCap === "number" ? coin.marketCap : undefined,
    volume24h: typeof coin.volume24h === "number" ? coin.volume24h : undefined,
    volMcapPct:
      typeof coin.volMcapPct === "number"
        ? coin.volMcapPct
        : typeof coin.marketCap === "number" && coin.marketCap > 0
          ? (coin.volume24h / coin.marketCap) * 100
          : undefined,
    source,
  };
}

/**
 * Deduplicate coins by stable key (prefer id, fallback to symbol)
 */
function deduplicateCoins(coins: Coin[]): Coin[] {
  const seen = new Map<string, Coin>();

  for (const coin of coins) {
    const key = coin.id.toLowerCase();
    if (!seen.has(key)) {
      seen.set(key, coin);
    }
  }

  return Array.from(seen.values());
}

/**
 * Fetch top N coins from CoinGecko
 */
async function fetchCoinGeckoTopCoins(limit: number = 500): Promise<Coin[]> {
  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/markets?vs_currency=usd&order=market_cap_desc&per_page=${Math.min(limit, 250)}&page=1&sparkline=false`,
      { next: { revalidate: 300 } } // cache for 5 minutes at fetch level
    );

    if (!response.ok) {
      console.warn("Failed to fetch CoinGecko top coins");
      return [];
    }

    const data = await response.json();

    return data.map((coin: any) =>
      normalizeCoin(
        {
          id: coin.id,
          symbol: coin.symbol,
          name: coin.name,
          marketCap: coin.market_cap,
          volume24h: coin.total_volume,
        },
        "coingecko"
      )
    );
  } catch (error) {
    console.error("Error fetching CoinGecko top coins:", error);
    return [];
  }
}

/**
 * Get common exchange symbols as coins
 */
function getExchangeSymbolCoins(): Coin[] {
  return COMMON_EXCHANGE_SYMBOLS.map((symbol) =>
    normalizeCoin(
      {
        id: `exchange:${symbol}`,
        baseSymbol: symbol,
        name: symbol,
      },
      "exchange"
    )
  );
}

/**
 * Fetch user-added symbols from database
 */
async function fetchUserAddedSymbols(userId: string): Promise<Coin[]> {
  try {
    const { getPrismaClient } = await import("@/lib/prismaClient");
    const prisma = getPrismaClient();

    const userSymbols = await prisma.userAddedSymbol.findMany({
      where: { userId },
    });

    return userSymbols.map((symbol) =>
      normalizeCoin(
        {
          id: `user:${symbol.id}`,
          symbol: symbol.symbol,
          name: symbol.name || symbol.symbol,
        },
        "user"
      )
    );
  } catch (error) {
    console.error("Error fetching user-added symbols:", error);
    return [];
  }
}

/**
 * Get merged, deduplicated universe of coins
 * Cached server-side for 2 minutes
 */
export async function getUniverseCoins(userId: string): Promise<Coin[]> {
  const cacheKey = `universe:${userId}`;

  // Check cache first
  const cached = universeCache.get<Coin[]>(cacheKey);
  if (cached) {
    return cached;
  }

  // Fetch from all sources in parallel
  const [coingeckoCoins, exchangeCoins, userCoins] = await Promise.all([
    fetchCoinGeckoTopCoins(500),
    Promise.resolve(getExchangeSymbolCoins()),
    fetchUserAddedSymbols(userId),
  ]);

  // Merge all sources
  const allCoins = [...coingeckoCoins, ...exchangeCoins, ...userCoins];

  // Deduplicate
  const deduped = deduplicateCoins(allCoins);

  // Sort by market cap (available) then name
  const sorted = deduped.sort((a, b) => {
    if (a.marketCap && b.marketCap) {
      return b.marketCap - a.marketCap;
    }
    if (a.marketCap) return -1;
    if (b.marketCap) return 1;
    return a.name.localeCompare(b.name);
  });

  // Cache for 2 minutes
  universeCache.set(cacheKey, sorted);

  return sorted;
}

/**
 * Add a symbol to user's custom universe
 */
export async function addUserSymbol(
  userId: string,
  symbol: string,
  name?: string
): Promise<void> {
  try {
    const { getPrismaClient } = await import("@/lib/prismaClient");
    const prisma = getPrismaClient();

    await prisma.userAddedSymbol.upsert({
      where: {
        userId_symbol: {
          userId,
          symbol: symbol.toUpperCase(),
        },
      },
      update: { name },
      create: {
        userId,
        symbol: symbol.toUpperCase(),
        name,
      },
    });

    // Invalidate user's cache
    universeCache.del(`universe:${userId}`);
  } catch (error) {
    console.error("Error adding user symbol:", error);
    throw error;
  }
}

/**
 * Remove a symbol from user's custom universe
 */
export async function removeUserSymbol(
  userId: string,
  symbol: string
): Promise<void> {
  try {
    const { getPrismaClient } = await import("@/lib/prismaClient");
    const prisma = getPrismaClient();

    await prisma.userAddedSymbol.delete({
      where: {
        userId_symbol: {
          userId,
          symbol: symbol.toUpperCase(),
        },
      },
    });

    // Invalidate user's cache
    universeCache.del(`universe:${userId}`);
  } catch (error) {
    console.error("Error removing user symbol:", error);
    throw error;
  }
}

/**
 * Get universe stats (for dev mode indicator)
 */
export async function getUniverseStats(userId: string): Promise<{
  total: number;
  coingecko: number;
  exchange: number;
  userAdded: number;
}> {
  const coins = await getUniverseCoins(userId);

  return {
    total: coins.length,
    coingecko: coins.filter((c) => c.source === "coingecko").length,
    exchange: coins.filter((c) => c.source === "exchange").length,
    userAdded: coins.filter((c) => c.source === "user").length,
  };
}
