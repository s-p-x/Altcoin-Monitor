/**
 * Exchange API Adapter
 * Fetches real OHLCV data from Binance
 */

import NodeCache from "node-cache";

// Cache OHLCV data for 5 seconds to avoid excessive API calls
const cache = new NodeCache({ stdTTL: 5, checkperiod: 10 });

interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: number;
}

/**
 * Normalize symbol to Binance format (e.g., "BTC" -> "BTCUSDT")
 */
function normalizeSymbol(symbol: string): string {
  const symbol_upper = symbol.toUpperCase();
  // If it's already a pair, return as-is
  if (symbol_upper.includes("/") || symbol_upper.includes("-")) {
    return symbol_upper.replace(/[/-]/g, "");
  }
  // Otherwise assume it's a coin and pair with USDT
  return `${symbol_upper}USDT`;
}

/**
 * Fetch candles from Binance
 */
export async function fetchCandles(
  symbol: string,
  timeframe: string = "1h",
  limit: number = 100
): Promise<Candle[]> {
  const normalizedSymbol = normalizeSymbol(symbol);
  const cacheKey = `${normalizedSymbol}:${timeframe}:${limit}`;

  // Check cache first
  const cached = cache.get<Candle[]>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    // Map timeframe to Binance format
    const interval = timeframeToInterval(timeframe);

    // Fetch from Binance public API
    const url = `https://api.binance.com/api/v3/klines?symbol=${normalizedSymbol}&interval=${interval}&limit=${limit}`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": "AltcoinMonitor/1.0",
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Symbol ${normalizedSymbol} not found on Binance`);
      }
      throw new Error(`Binance API error: ${response.status}`);
    }

    const data: unknown = await response.json();
    const rows = Array.isArray(data) ? data : [];

    // Parse Binance klines format
    // [open time, open, high, low, close, volume, close time, quote asset volume, trades, taker buy base, taker buy quote, ignore]
    const candles: Candle[] = rows
      .filter(Array.isArray)
      .map((kline) => ({
        timestamp: typeof kline[0] === "number" ? kline[0] : Number(kline[0]),
        open: Number(kline[1]),
        high: Number(kline[2]),
        low: Number(kline[3]),
        close: Number(kline[4]),
        volume: Number(kline[7]), // Use quote asset volume for volume in USDT
      }))
      .filter((candle) => Number.isFinite(candle.timestamp));

    // Cache the result
    cache.set(cacheKey, candles);

    return candles;
  } catch (error) {
    console.error(`Failed to fetch candles for ${normalizedSymbol}:`, error);
    throw error;
  }
}

/**
 * Convert timeframe string to Binance interval format
 */
function timeframeToInterval(timeframe: string): string {
  const timeframeUpper = timeframe.toUpperCase();
  const intervalMap: Record<string, string> = {
    "1M": "1m",
    "5M": "5m",
    "15M": "15m",
    "30M": "30m",
    "1H": "1h",
    "4H": "4h",
    "1D": "1d",
    "1W": "1w",
    "1MO": "1M",
  };

  return intervalMap[timeframeUpper] || "1h";
}

/**
 * Calculate volume spike ratio
 */
export function calculateVolumeSpike(
  candles: Candle[],
  baselineCandles: number = 20
): { current: number; baseline: number; ratio: number } {
  if (candles.length === 0) {
    return { current: 0, baseline: 0, ratio: 0 };
  }

  // Current candle is the last one
  const currentVolume = candles[candles.length - 1].volume;

  // Calculate baseline from previous candles
  const baselineData = candles.slice(0, Math.max(baselineCandles, 1));
  const averageBaseline = baselineData.reduce((sum, c) => sum + c.volume, 0) / baselineData.length;

  const ratio = averageBaseline > 0 ? currentVolume / averageBaseline : 0;

  return {
    current: currentVolume,
    baseline: averageBaseline,
    ratio,
  };
}

/**
 * Get current price for a symbol
 */
export async function getCurrentPrice(symbol: string): Promise<number> {
  const normalizedSymbol = normalizeSymbol(symbol);

  try {
    const url = `https://api.binance.com/api/v3/ticker/price?symbol=${normalizedSymbol}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch price for ${normalizedSymbol}`);
    }

    const data = await response.json();
    return parseFloat(data.price);
  } catch (error) {
    console.error(`Failed to get price for ${normalizedSymbol}:`, error);
    throw error;
  }
}

/**
 * Check if symbol exists on Binance
 */
export async function symbolExists(symbol: string): Promise<boolean> {
  const normalizedSymbol = normalizeSymbol(symbol);

  try {
    const url = `https://api.binance.com/api/v3/exchangeInfo`;
    const response = await fetch(url);

    if (!response.ok) {
      return false;
    }

    const data: unknown = await response.json();
    if (!data || typeof data !== "object" || !("symbols" in data)) {
      return false;
    }
    const symbols = (data as { symbols?: unknown }).symbols;
    if (!Array.isArray(symbols)) {
      return false;
    }
    return symbols.some((s) => {
      if (!s || typeof s !== "object") return false;
      const symbolValue = (s as { symbol?: unknown }).symbol;
      const statusValue = (s as { status?: unknown }).status;
      return (
        symbolValue === normalizedSymbol &&
        statusValue === "TRADING"
      );
    });
  } catch (error) {
    console.error("Failed to check symbol existence:", error);
    return false;
  }
}
