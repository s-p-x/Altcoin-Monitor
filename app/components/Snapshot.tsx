'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Search, AlertCircle, CheckCircle, Calendar, Clock, Zap } from 'lucide-react';
import SnapshotChart from './SnapshotChart';

interface CoinSearchResult {
  id: string;
  name: string;
  symbol: string;
  market_cap_rank?: number | null;
}

interface SnapshotData {
  price: number;
  market_cap: number;
  volume: number;
  volumeToMcapRatio: number;
  timestamp: number;
  dataTime: string;
}

interface ChartDataPoint {
  timestamp: number;
  volume: number;
  time: string;
  isTarget: boolean;
}

const Snapshot: React.FC = () => {
  const [ticker, setTicker] = useState('');
  const [datetime, setDatetime] = useState('');
  const [window, setWindow] = useState('24h');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<CoinSearchResult[]>([]);
  const [selectedCoin, setSelectedCoin] = useState<CoinSearchResult | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [snapshotData, setSnapshotData] = useState<SnapshotData | null>(null);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [searching, setSearching] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('snapshotState');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setTicker(parsed.ticker || '');
        setDatetime(parsed.datetime || '');
        setWindow(parsed.window || '24h');
        if (parsed.selectedCoin) {
          setSelectedCoin(parsed.selectedCoin);
        }
      } catch (e) {
        console.error('Failed to parse saved snapshot state:', e);
      }
    }
  }, []);

  // Save to localStorage whenever state changes
  useEffect(() => {
    const state = { ticker, datetime, window, selectedCoin };
    localStorage.setItem('snapshotState', JSON.stringify(state));
  }, [ticker, datetime, window, selectedCoin]);

  // Search for coin
  const handleSearchTicker = useCallback(async (query: string) => {
    if (!query || query.trim().length === 0) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/coingecko/search?query=${encodeURIComponent(query)}`
      );

      if (!response.ok) {
        throw new Error(`Search failed with status ${response.status}`);
      }

      const data = await response.json();
      const coins = (data.coins || []).slice(0, 10) as CoinSearchResult[];
      setSearchResults(coins);
      setShowDropdown(true);
    } catch (err) {
      console.error('Search error:', err);
      setError('Failed to search coins. Please try again.');
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      handleSearchTicker(ticker);
    }, 300);

    return () => clearTimeout(timer);
  }, [ticker, handleSearchTicker]);

  // Get window duration in milliseconds and seconds
  const getWindowDuration = () => {
    const durationMap: { [key: string]: number } = {
      '6h': 6 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
    };
    return durationMap[window] || durationMap['24h'];
  };

  // Find closest data point to target timestamp
  const findClosestDataPoint = (
    data: [number, number][],
    targetTimestamp: number
  ): { timestamp: number; value: number } | null => {
    if (!data || data.length === 0) return null;

    let closest = data[0];
    let minDiff = Math.abs(data[0][0] - targetTimestamp);

    for (const point of data) {
      const diff = Math.abs(point[0] - targetTimestamp);
      if (diff < minDiff) {
        minDiff = diff;
        closest = point;
      }
    }

    return { timestamp: closest[0], value: closest[1] };
  };

  // Load snapshot
  const handleLoadSnapshot = useCallback(async () => {
    if (!selectedCoin || !datetime) {
      setError('Please select a coin and datetime');
      return;
    }

    setLoading(true);
    setError(null);
    setSnapshotData(null);
    setChartData([]);

    try {
      // Convert datetime-local to timestamp
      const targetDate = new Date(datetime);
      if (isNaN(targetDate.getTime())) {
        throw new Error('Invalid datetime');
      }

      const targetTimestampMs = targetDate.getTime();
      const targetTimestampSec = Math.floor(targetTimestampMs / 1000);

      // Calculate from/to based on window
      const windowDurationMs = getWindowDuration();
      const fromTimestampSec = Math.floor(
        (targetTimestampMs - windowDurationMs) / 1000
      );
      const toTimestampSec = Math.floor(
        (targetTimestampMs + windowDurationMs) / 1000
      );

      // Fetch historical data
      const response = await fetch(
        `/api/coingecko/market_chart_range?id=${encodeURIComponent(
          selectedCoin.id
        )}&from=${fromTimestampSec}&to=${toTimestampSec}`
      );

      if (!response.ok) {
        throw new Error(
          `Failed to fetch market data with status ${response.status}`
        );
      }

      const chartResponse = await response.json();

      if (
        !chartResponse.prices ||
        !chartResponse.market_caps ||
        !chartResponse.total_volumes
      ) {
        throw new Error('Invalid market chart data format');
      }

      // Find closest data points
      const closestPrice = findClosestDataPoint(
        chartResponse.prices,
        targetTimestampMs
      );
      const closestMarketCap = findClosestDataPoint(
        chartResponse.market_caps,
        targetTimestampMs
      );
      const closestVolume = findClosestDataPoint(
        chartResponse.total_volumes,
        targetTimestampMs
      );

      if (!closestPrice || !closestMarketCap || !closestVolume) {
        throw new Error('No data found near the requested time');
      }

      // Calculate vol/mcap ratio
      const volumeToMcapRatio =
        closestMarketCap.value > 0
          ? (closestVolume.value / closestMarketCap.value) * 100
          : 0;

      const snapshot: SnapshotData = {
        price: closestPrice.value,
        market_cap: closestMarketCap.value,
        volume: closestVolume.value,
        volumeToMcapRatio,
        timestamp: closestPrice.timestamp,
        dataTime: new Date(closestPrice.timestamp).toLocaleString(),
      };

      setSnapshotData(snapshot);

      // Prepare chart data
      const chartPoints: ChartDataPoint[] = chartResponse.total_volumes.map(
        (point: [number, number]) => {
          const pointTime = new Date(point[0]);
          return {
            timestamp: point[0],
            volume: point[1],
            time: pointTime.toLocaleTimeString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            }),
            isTarget: Math.abs(point[0] - closestVolume.timestamp) < 1000, // Within 1 second
          };
        }
      );

      setChartData(chartPoints);
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : 'Unknown error occurred';
      console.error('Snapshot load error:', err);
      setError(`Failed to load snapshot: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  }, [selectedCoin, datetime, window]);

  const formatNumber = (num: number) => {
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
    return `$${num.toFixed(2)}`;
  };

  return (
    <div className="space-y-6">
      {/* Form Section */}
      <div className="bg-[var(--panel)] rounded-lg border border-[var(--border)] p-6">
        <h2 className="text-2xl font-bold text-[var(--text)] mb-6 flex items-center gap-2">
          <Calendar className="w-6 h-6 text-[var(--accent)]" />
          Time Machine Snapshot
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {/* Ticker Input */}
          <div className="relative">
            <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">
              Coin Ticker
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[var(--text-faint)]" />
              <input
                type="text"
                value={ticker}
                onChange={(e) => setTicker(e.target.value)}
                placeholder="e.g., BTC, ETH, XRP..."
                className="w-full pl-9 pr-3 py-2 border border-[var(--border)] bg-[var(--panel)] text-[var(--text)] rounded-lg placeholder-[var(--text-faint)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>

            {/* Dropdown Results */}
            {showDropdown && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--panel)] border border-[var(--border)] rounded-lg shadow-lg z-10">
                {searchResults.map((coin) => (
                  <button
                    key={coin.id}
                    onClick={() => {
                      setSelectedCoin(coin);
                      setTicker(coin.symbol.toUpperCase());
                      setShowDropdown(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-[var(--bg)] transition-colors border-b border-[var(--border)] last:border-b-0"
                  >
                    <div className="font-medium text-[var(--text)]">
                      {coin.symbol.toUpperCase()}
                    </div>
                    <div className="text-xs text-[var(--text-muted)]">
                      {coin.name}
                      {coin.market_cap_rank &&
                        ` • Rank #${coin.market_cap_rank}`}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {selectedCoin && (
              <div className="mt-2 text-xs text-[var(--semantic-green)] flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                {selectedCoin.name} ({selectedCoin.id})
              </div>
            )}
          </div>

          {/* Datetime Input */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">
              Date & Time
            </label>
            <input
              type="datetime-local"
              value={datetime}
              onChange={(e) => setDatetime(e.target.value)}
              className="w-full px-3 py-2 border border-[var(--border)] bg-[var(--panel)] text-[var(--text)] rounded-lg focus:outline-none focus:border-[var(--accent)]"
            />
          </div>

          {/* Window Selector */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">
              Time Window
            </label>
            <select
              value={window}
              onChange={(e) => setWindow(e.target.value)}
              className="w-full px-3 py-2 border border-[var(--border)] bg-[var(--panel)] text-[var(--text)] rounded-lg focus:outline-none focus:border-[var(--accent)]"
            >
              <option value="6h">6 hours</option>
              <option value="24h">24 hours</option>
              <option value="7d">7 days</option>
              <option value="30d">30 days</option>
            </select>
          </div>

          {/* Load Button */}
          <div className="flex items-end">
            <button
              onClick={handleLoadSnapshot}
              disabled={loading || !selectedCoin || !datetime}
              className="w-full px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:bg-opacity-80 disabled:bg-[var(--text-faint)] disabled:text-[var(--text-muted)] flex items-center justify-center gap-2 border border-[var(--accent)] transition-all font-medium"
            >
              <Zap className="w-4 h-4" />
              {loading ? 'Loading...' : 'Load Snapshot'}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-4 bg-[var(--panel)] border-l-4 border-[var(--semantic-red)] rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-[var(--semantic-red)] mt-0.5" />
              <p className="text-sm text-[var(--text-muted)]">{error}</p>
            </div>
          </div>
        )}
      </div>

      {/* Snapshot Stats */}
      {snapshotData && (
        <div className="bg-[var(--panel)] rounded-lg border border-[var(--border)] p-6">
          <h3 className="text-lg font-semibold text-[var(--text)] mb-4">
            Snapshot Stats
          </h3>
          <p className="text-xs text-[var(--text-faint)] mb-4">
            Data from: {snapshotData.dataTime}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-[var(--bg)] p-4 rounded-lg border border-[var(--accent)] border-opacity-30">
              <div className="text-sm text-[var(--text-muted)] mb-1">Price</div>
              <div className="text-2xl font-bold text-[var(--accent)]">
                ${snapshotData.price.toFixed(2)}
              </div>
            </div>
            <div className="bg-[var(--bg)] p-4 rounded-lg border border-[var(--accent)] border-opacity-30">
              <div className="text-sm text-[var(--text-muted)] mb-1">
                Market Cap
              </div>
              <div className="text-2xl font-bold text-[var(--accent)]">
                {formatNumber(snapshotData.market_cap)}
              </div>
            </div>
            <div className="bg-[var(--bg)] p-4 rounded-lg border border-[var(--accent)] border-opacity-30">
              <div className="text-sm text-[var(--text-muted)] mb-1">
                24h Volume
              </div>
              <div className="text-2xl font-bold text-[var(--accent)]">
                {formatNumber(snapshotData.volume)}
              </div>
            </div>
            <div className="bg-[var(--bg)] p-4 rounded-lg border border-[var(--semantic-green)] border-opacity-30">
              <div className="text-sm text-[var(--text-muted)] mb-1">
                Vol/MCap %
              </div>
              <div className="text-2xl font-bold text-[var(--semantic-green)]">
                {snapshotData.volumeToMcapRatio.toFixed(2)}%
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chart */}
      {chartData.length > 0 && (
        <SnapshotChart
          data={chartData}
          targetTimestamp={snapshotData?.timestamp || 0}
          loading={loading}
        />
      )}
    </div>
  );
};

export default Snapshot;
