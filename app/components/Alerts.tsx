"use client";

import { useState, useRef, useEffect } from "react";
import { AlertCircle, Clock, TrendingUp, Zap } from "lucide-react";

interface AlertResult {
  pair: string;
  symbol: string;
  timeframe: string;
  ratio: number;
  closedVolume: number;
  baselineVolume: number;
  closedCandleTime: number;
}

const TIMEFRAMES = ["1m", "5m", "15m", "1h", "4h", "1d"];
const MULTIPLIERS = [2, 3];
const MAX_COINS_OPTIONS = [25, 50, 100];

// Demo data for development
const DEMO_ALERTS: AlertResult[] = [
  {
    pair: "SOL/USDT",
    symbol: "SOL",
    timeframe: "1h",
    ratio: 3.2,
    closedVolume: 12500000,
    baselineVolume: 3900000,
    closedCandleTime: Date.now() - 300000,
  },
  {
    pair: "PEPE/USDT",
    symbol: "PEPE",
    timeframe: "1h",
    ratio: 2.8,
    closedVolume: 5800000,
    baselineVolume: 2100000,
    closedCandleTime: Date.now() - 600000,
  },
  {
    pair: "ARB/USDT",
    symbol: "ARB",
    timeframe: "1h",
    ratio: 2.4,
    closedVolume: 4200000,
    baselineVolume: 1750000,
    closedCandleTime: Date.now() - 900000,
  },
];

export default function Alerts() {
  const [exchange, setExchange] = useState("binance");
  const [multiplier, setMultiplier] = useState(2);
  const [baselineBars, setBaselineBars] = useState(20);
  const [maxCoins, setMaxCoins] = useState(50);
  const [selectedTimeframe, setSelectedTimeframe] = useState("1h");
  const [isScanning, setIsScanning] = useState(false);
  const [results, setResults] = useState<AlertResult[] | null>(null);
  const [lastScanTime, setLastScanTime] = useState<number | null>(null);
  const [autoMode, setAutoMode] = useState(false);
  const [demoMode, setDemoMode] = useState(true);

  const wheelRef = useRef<HTMLDivElement>(null);
  const autoScanInterval = useRef<NodeJS.Timeout | null>(null);

  // Auto-scan logic
  useEffect(() => {
    if (!autoMode) {
      if (autoScanInterval.current) {
        clearInterval(autoScanInterval.current);
        autoScanInterval.current = null;
      }
      return;
    }

    const performScan = async () => {
      await handleScan();
    };

    performScan();
    autoScanInterval.current = setInterval(performScan, 60000); // 60 seconds

    return () => {
      if (autoScanInterval.current) {
        clearInterval(autoScanInterval.current);
        autoScanInterval.current = null;
      }
    };
  }, [autoMode, multiplier]);

  const handleScan = async () => {
    setIsScanning(true);

    // Simulate scan delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Filter demo data by multiplier
    const filtered = DEMO_ALERTS.filter((alert) => alert.ratio >= multiplier);
    setResults(filtered);
    setLastScanTime(Date.now());
    setIsScanning(false);
  };

  // Handle scroll wheel for timeframe selection
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const delta = Math.sign(e.deltaY);
    const currentIndex = TIMEFRAMES.indexOf(selectedTimeframe);
    const newIndex = Math.max(
      0,
      Math.min(TIMEFRAMES.length - 1, currentIndex + delta)
    );
    setSelectedTimeframe(TIMEFRAMES[newIndex]);
  };

  return (
    <div className="space-y-6">
      {/* Demo Mode Banner */}
      {demoMode && (
        <div className="bg-amber-900/20 border border-amber-700 rounded p-3 flex items-start gap-3">
          <Zap className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
          <div className="text-sm">
            <p className="text-amber-300 font-medium">Demo Mode</p>
            <p className="text-amber-200/70 text-xs mt-1">
              Full integration with exchange OHLCV data coming soon. Currently using simulated data for UI development.
            </p>
          </div>
        </div>
      )}

      {/* Controls Section */}
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {/* Exchange */}
          <div>
            <label className="block text-xs text-gray-400 mb-2">Exchange</label>
            <select
              value={exchange}
              onChange={(e) => setExchange(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white"
            >
              <option value="binance">Binance</option>
              <option value="kucoin">KuCoin</option>
              <option value="kraken">Kraken</option>
            </select>
          </div>

          {/* Multiplier */}
          <div>
            <label className="block text-xs text-gray-400 mb-2">Multiplier</label>
            <div className="flex gap-2">
              {MULTIPLIERS.map((m) => (
                <button
                  key={m}
                  onClick={() => setMultiplier(m)}
                  className={`flex-1 py-2 rounded text-sm font-medium transition-colors ${
                    multiplier === m
                      ? "bg-blue-600 text-white"
                      : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                  }`}
                >
                  {m}×
                </button>
              ))}
            </div>
          </div>

          {/* Baseline Bars */}
          <div>
            <label className="block text-xs text-gray-400 mb-2">Baseline Bars</label>
            <input
              type="number"
              value={baselineBars}
              onChange={(e) => setBaselineBars(Math.max(1, parseInt(e.target.value)))}
              min={1}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white"
            />
          </div>

          {/* Max Coins */}
          <div>
            <label className="block text-xs text-gray-400 mb-2">Max Coins</label>
            <select
              value={maxCoins}
              onChange={(e) => setMaxCoins(parseInt(e.target.value))}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white"
            >
              {MAX_COINS_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Timeframe Scroll Wheel */}
        <div>
          <label className="block text-xs text-gray-400 mb-2">Timeframe (scroll to select)</label>
          <div
            ref={wheelRef}
            onWheel={handleWheel}
            className="bg-gray-900 border border-gray-700 rounded p-4 overflow-hidden"
          >
            <div className="flex flex-col items-center space-y-1">
              {TIMEFRAMES.map((tf, idx) => {
                const distance = Math.abs(TIMEFRAMES.indexOf(selectedTimeframe) - idx);
                const isSelected = tf === selectedTimeframe;
                return (
                  <div
                    key={tf}
                    onClick={() => setSelectedTimeframe(tf)}
                    className={`py-2 px-4 rounded cursor-pointer transition-all ${
                      isSelected
                        ? "text-blue-400 text-lg font-bold bg-gray-800 border border-blue-500"
                        : distance === 1
                          ? "text-gray-500 text-sm opacity-60"
                          : "text-gray-600 text-xs opacity-40"
                    }`}
                  >
                    {tf}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-2">
          <button
            onClick={handleScan}
            disabled={isScanning}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white py-2 rounded font-medium transition-colors"
          >
            {isScanning ? "Scanning..." : "Scan Now"}
          </button>
          <button
            onClick={() => setAutoMode(!autoMode)}
            className={`flex-1 py-2 rounded font-medium transition-colors ${
              autoMode
                ? "bg-green-600 hover:bg-green-700 text-white"
                : "bg-gray-800 hover:bg-gray-700 text-gray-300"
            }`}
          >
            {autoMode ? "Auto ON" : "Auto OFF"}
          </button>
        </div>
      </div>

      {/* Results Section */}
      {results && results.length > 0 ? (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="bg-gray-900 border border-gray-700 rounded p-3">
              <div className="text-gray-400 text-xs mb-1">Total Coins</div>
              <div className="text-lg font-bold text-white">{maxCoins}</div>
            </div>
            <div className="bg-gray-900 border border-gray-700 rounded p-3">
              <div className="text-gray-400 text-xs mb-1">Timeframe</div>
              <div className="text-lg font-bold text-white">{selectedTimeframe}</div>
            </div>
            <div className="bg-gray-900 border border-gray-700 rounded p-3">
              <div className="text-gray-400 text-xs mb-1">Triggered</div>
              <div className="text-lg font-bold text-green-400">{results.length}</div>
            </div>
          </div>

          {/* Scan Time */}
          {lastScanTime && (
            <div className="text-xs text-gray-500">
              Last scan: {new Date(lastScanTime).toLocaleTimeString()}
              {autoMode && " (auto-refresh: 60s)"}
            </div>
          )}

          {/* Triggered Coins Table */}
          <div className="bg-gray-900 border border-gray-700 rounded overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700 bg-gray-800/50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300">
                      Coin
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-300">
                      Ratio
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-300">
                      Close Vol
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-300">
                      Baseline
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-300">
                      Time
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((alert, idx) => (
                    <tr
                      key={idx}
                      className="border-b border-gray-800 hover:bg-gray-800/30 transition-colors"
                    >
                      <td className="px-4 py-3 font-mono text-sm">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-green-400" />
                          <span className="font-bold text-green-400">
                            {alert.symbol}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-900/30 border border-green-700 rounded text-green-300 font-mono text-sm">
                          <TrendingUp className="w-3 h-3" />
                          {alert.ratio.toFixed(2)}×
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-300">
                        {(alert.closedVolume / 1000000).toFixed(1)}M
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-400 text-xs">
                        {(alert.baselineVolume / 1000000).toFixed(2)}M
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-gray-500">
                        <div className="flex items-center justify-end gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(alert.closedCandleTime).toLocaleTimeString()}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : results ? (
        <div className="bg-gray-900 border border-gray-700 rounded p-8 text-center text-gray-400">
          <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No volume spikes matching {multiplier}× threshold on {selectedTimeframe}</p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-700 rounded p-8 text-center text-gray-400">
          <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Click "Scan Now" to detect volume spikes</p>
        </div>
      )}
    </div>
  );
}
