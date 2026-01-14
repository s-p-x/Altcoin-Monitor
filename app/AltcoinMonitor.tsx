'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { TrendingUp, RefreshCw, Download, Bell, Filter, AlertCircle, CheckCircle, Key, Clock } from 'lucide-react';

const AltcoinMonitor = () => {
  const [coins, setCoins] = useState([]);
  const [filteredCoins, setFilteredCoins] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [apiKey, setApiKey] = useState('');
  const [apiKeySet, setApiKeySet] = useState(false);
  const [filters, setFilters] = useState({
    minMarketCap: 125000000,
    maxMarketCap: 25000000000,
    minVolume: 50000000,
    minVolumeChange: 10,
    volumeSpikeThreshold: 100
  });
  const [volumeSpikes, setVolumeSpikes] = useState([]);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'total_volume', direction: 'desc' });
  const [apiStatus, setApiStatus] = useState('idle');
  const [cacheExpiry, setCacheExpiry] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [debugInfo, setDebugInfo] = useState(null);

  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  const MAX_RETRIES = 3;
  const BASE_BACKOFF = 1000; // 1 second

  // Load API key from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('coingeckoApiKey');
    if (stored) {
      setApiKey(stored);
      setApiKeySet(true);
    }
  }, []);

  // Save API key to localStorage
  const saveApiKey = () => {
    if (apiKey.trim()) {
      localStorage.setItem('coingeckoApiKey', apiKey.trim());
      setApiKeySet(true);
      setError(null);
    }
  };

  // Clear API key
  const clearApiKey = () => {
    localStorage.removeItem('coingeckoApiKey');
    setApiKey('');
    setApiKeySet(false);
  };

  // Check if cache is still valid
  const isCacheValid = () => {
    if (!cacheExpiry) return false;
    return Date.now() < cacheExpiry;
  };

  // Exponential backoff delay
  const getBackoffDelay = (attempt) => {
    return BASE_BACKOFF * Math.pow(2, attempt);
  };

  // Fetch coin data with proper error handling and retries
  const fetchCoins = useCallback(async (forceRefresh = false) => {
    // Check cache first
    if (!forceRefresh && isCacheValid()) {
      console.log('📦 Using cached data (expires in', Math.round((cacheExpiry - Date.now()) / 1000), 'seconds)');
      setDebugInfo({
        message: 'Using cached data',
        timestamp: new Date().toISOString(),
        cacheExpiry: new Date(cacheExpiry).toISOString()
      });
      return;
    }

    setLoading(true);
    setError(null);
    setApiStatus('fetching');
    
    let attempt = 0;
    
    while (attempt < MAX_RETRIES) {
      try {
        // Store previous volumes for spike detection
        const previousCoins = coins.reduce((acc, coin) => {
          acc[coin.id] = coin.total_volume;
          return acc;
        }, {});
        
        console.log(`🔄 Attempt ${attempt + 1}/${MAX_RETRIES}: Fetching from proxy...`);
        
        // Fetch from proxy instead of directly from CoinGecko
        const response = await fetch('/api/coingecko/markets');

        // Log full response details for debugging
        const responseClone = response.clone();
        const statusInfo = {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries([...response.headers.entries()]),
          timestamp: new Date().toISOString()
        };

        console.log('📡 Response status:', response.status, response.statusText);

        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          const backoffDelay = retryAfter ? parseInt(retryAfter) * 1000 : getBackoffDelay(attempt);
          
          console.warn(`⏳ Rate limited (429). Retrying in ${backoffDelay}ms...`);
          
          setDebugInfo({
            ...statusInfo,
            message: `Rate limited. Retry after ${backoffDelay}ms`,
            attempt: attempt + 1
          });
          
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
          attempt++;
          continue;
        }

        if (!response.ok) {
          const errorBody = await responseClone.text();
          let errorJson;
          try {
            errorJson = JSON.parse(errorBody);
          } catch {
            errorJson = { raw: errorBody };
          }

          console.error('❌ API Error:', {
            ...statusInfo,
            body: errorJson
          });

          setDebugInfo({
            ...statusInfo,
            body: errorJson,
            message: 'API request failed'
          });

          throw new Error(`API Error ${response.status}: ${errorJson.status?.error_message || response.statusText}`);
        }
        
        const result = await response.json();
        console.log('✓ Received coins:', result.length);
        
        if (!Array.isArray(result) || result.length === 0) {
          throw new Error('Invalid API response format');
        }

        // Process and normalize data from CoinGecko
        const newSpikes = [];
        const processedData = result.map(coin => {
          const volume = coin.total_volume || 0;
          const marketCap = coin.market_cap || 0;
          const volumeToMcapRatio = marketCap > 0 ? (volume / marketCap) * 100 : 0;
          
          // Detect volume spikes
          if (previousCoins[coin.id] && volume > 0 && previousCoins[coin.id] > 0) {
            const volumeIncrease = ((volume - previousCoins[coin.id]) / previousCoins[coin.id]) * 100;
            if (volumeIncrease > filters.volumeSpikeThreshold) {
              newSpikes.push({
                id: coin.id,
                name: coin.name,
                symbol: coin.symbol,
                volumeIncrease: volumeIncrease.toFixed(2),
                timestamp: new Date().toLocaleTimeString()
              });
            }
          }
          
          return {
            id: coin.id,
            rank: coin.market_cap_rank,
            name: coin.name,
            symbol: coin.symbol,
            slug: coin.id,
            price: coin.current_price || 0,
            market_cap: marketCap,
            total_volume: volume,
            volume_to_mcap_ratio: volumeToMcapRatio,
            price_change_24h: coin.price_change_percentage_24h || 0,
            volume_change_24h: 0,
            image: coin.image
          };
        });
        
        setCoins(processedData);
        if (newSpikes.length > 0) {
          setVolumeSpikes(prev => [...newSpikes, ...prev].slice(0, 20));
        }
        
        const now = Date.now();
        setLastUpdate(new Date(now));
        setCacheExpiry(now + CACHE_TTL);
        setApiStatus('success');
        setRetryCount(0);
        
        setDebugInfo({
          ...statusInfo,
          message: 'Success',
          coinsReceived: processedData.length,
          cacheExpiry: new Date(now + CACHE_TTL).toISOString(),
          rateLimitRemaining: response.headers.get('X-RateLimit-Remaining') || 'N/A'
        });
        
        console.log('✓ Cache updated. Expires at:', new Date(now + CACHE_TTL).toLocaleString());
        
        break; // Success, exit retry loop
        
      } catch (err) {
        console.error(`❌ Attempt ${attempt + 1} failed:`, err);
        
        if (attempt === MAX_RETRIES - 1) {
          // Last attempt failed
          setError(err.message || 'Failed to fetch data after multiple attempts');
          setApiStatus('error');
          setRetryCount(attempt + 1);
        } else {
          // Wait before retrying
          const backoffDelay = getBackoffDelay(attempt);
          console.log(`⏳ Waiting ${backoffDelay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
        }
        
        attempt++;
      }
    }
    
    setLoading(false);
  }, [coins, filters.volumeSpikeThreshold, cacheExpiry]);

  // Apply filters
  useEffect(() => {
    if (coins.length === 0) return;
    
    const filtered = coins.filter(coin => {
      const marketCap = coin.market_cap || 0;
      const volume = coin.total_volume || 0;
      const volumeToMcapRatio = coin.volume_to_mcap_ratio || 0;
      
      return (
        marketCap >= filters.minMarketCap &&
        marketCap <= filters.maxMarketCap &&
        volume >= filters.minVolume &&
        volumeToMcapRatio >= filters.minVolumeChange
      );
    });
    
    console.log('📊 Filtered:', filtered.length, 'of', coins.length, 'coins');
    setFilteredCoins(filtered);
  }, [coins, filters]);

  // Auto-refresh with cache awareness
  useEffect(() => {
    let interval;
    if (autoRefresh) {
      interval = setInterval(() => {
        if (!isCacheValid()) {
          fetchCoins(true);
        }
      }, 60000); // Check every minute
    }
    return () => clearInterval(interval);
  }, [autoRefresh, fetchCoins, cacheExpiry]);

  // Sort coins
  const sortedCoins = [...filteredCoins].sort((a, b) => {
    const aVal = a[sortConfig.key] || 0;
    const bVal = b[sortConfig.key] || 0;
    return sortConfig.direction === 'asc' ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1);
  });

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  // Export to CSV
  const exportToCSV = () => {
    const headers = ['Rank', 'Name', 'Symbol', 'Price', 'Market Cap', '24h Volume', 'Vol/MCap %', '24h Price Change %'];
    const rows = sortedCoins.map(coin => [
      coin.rank,
      coin.name,
      coin.symbol,
      coin.price,
      coin.market_cap,
      coin.total_volume,
      coin.volume_to_mcap_ratio?.toFixed(2) || 0,
      coin.price_change_24h?.toFixed(2) || 0
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `altcoins_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const formatNumber = (num) => {
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
    return `$${num?.toFixed(2) || 0}`;
  };

  const SortIcon = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) return <span className="text-gray-300">⇅</span>;
    return sortConfig.direction === 'desc' ? <span>↓</span> : <span>↑</span>;
  };

  const getCacheTimeRemaining = () => {
    if (!cacheExpiry) return null;
    const remaining = Math.max(0, Math.round((cacheExpiry - Date.now()) / 1000));
    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* API Key Setup */}
        {!apiKeySet && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
            <div className="flex items-start gap-3">
              <Key className="w-6 h-6 text-yellow-600 mt-1" />
              <div className="flex-1">
                <h3 className="font-semibold text-yellow-900 mb-2">CoinGecko API Key (Optional)</h3>
                <p className="text-sm text-yellow-800 mb-4">
                  This app uses the free CoinGecko API by default. For higher rate limits, enter your API key from{' '}
                  <a href="https://www.coingecko.com/en/api/pricing" target="_blank" rel="noopener noreferrer" className="underline">
                    coingecko.com/api/pricing
                  </a>
                </p>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Enter your API key (optional)..."
                    className="flex-1 px-3 py-2 border border-yellow-300 rounded-lg"
                    onKeyPress={(e) => e.key === 'Enter' && saveApiKey()}
                  />
                  <button
                    onClick={saveApiKey}
                    className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
                  >
                    Save Key
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                <TrendingUp className="w-8 h-8 text-blue-600" />
                Altcoin Volume Monitor
              </h1>
              <div className="flex items-center gap-3 mt-2">
                <p className="text-gray-600">
                  {lastUpdate && `Last updated: ${lastUpdate.toLocaleTimeString()}`}
                </p>
                {apiStatus === 'success' && (
                  <span className="flex items-center gap-1 text-green-600 text-sm">
                    <CheckCircle className="w-4 h-4" /> API Connected
                  </span>
                )}
                {apiStatus === 'error' && (
                  <span className="flex items-center gap-1 text-red-600 text-sm">
                    <AlertCircle className="w-4 h-4" /> API Error
                  </span>
                )}
                {cacheExpiry && isCacheValid() && (
                  <span className="flex items-center gap-1 text-blue-600 text-sm">
                    <Clock className="w-4 h-4" /> Cache: {getCacheTimeRemaining()}
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-3 flex-wrap">
              {apiKeySet && (
                <button
                  onClick={clearApiKey}
                  className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm"
                >
                  Change API Key
                </button>
              )}
              <button
                onClick={() => fetchCoins(true)}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                {loading ? 'Loading...' : 'Refresh'}
              </button>
              <button
                onClick={exportToCSV}
                disabled={sortedCoins.length === 0}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                  autoRefresh ? 'bg-orange-600 text-white' : 'bg-gray-200 text-gray-700'
                }`}
              >
                <Bell className="w-4 h-4" />
                Auto {autoRefresh ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-red-900">Error</p>
                  <p className="text-sm text-red-700">{error}</p>
                  {retryCount > 0 && (
                    <p className="text-xs text-red-600 mt-1">Failed after {retryCount} attempts</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Debug Info */}
          {debugInfo && (
            <details className="mb-4 p-3 bg-gray-100 rounded-lg text-xs">
              <summary className="cursor-pointer font-semibold text-gray-700">Debug Info</summary>
              <pre className="mt-2 overflow-x-auto text-gray-600">
                {JSON.stringify(debugInfo, null, 2)}
              </pre>
            </details>
          )}

          {/* Filters */}
          <div className="grid grid-cols-5 gap-4 p-4 bg-gray-50 rounded-lg">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Min Market Cap
              </label>
              <input
                type="number"
                value={filters.minMarketCap}
                onChange={(e) => setFilters({ ...filters, minMarketCap: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <span className="text-xs text-gray-500">
                {formatNumber(filters.minMarketCap)}
              </span>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Max Market Cap
              </label>
              <input
                type="number"
                value={filters.maxMarketCap}
                onChange={(e) => setFilters({ ...filters, maxMarketCap: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <span className="text-xs text-gray-500">
                {formatNumber(filters.maxMarketCap)}
              </span>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Min Volume (24h)
              </label>
              <input
                type="number"
                value={filters.minVolume}
                onChange={(e) => setFilters({ ...filters, minVolume: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <span className="text-xs text-gray-500">
                {formatNumber(filters.minVolume)}
              </span>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Min Vol/MCap %
              </label>
              <input
                type="number"
                value={filters.minVolumeChange}
                onChange={(e) => setFilters({ ...filters, minVolumeChange: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <span className="text-xs text-gray-500">
                {filters.minVolumeChange}%
              </span>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Spike Threshold %
              </label>
              <input
                type="number"
                value={filters.volumeSpikeThreshold}
                onChange={(e) => setFilters({ ...filters, volumeSpikeThreshold: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <span className="text-xs text-gray-500">
                {filters.volumeSpikeThreshold}%
              </span>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mt-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600">Total Coins Fetched</div>
              <div className="text-2xl font-bold text-blue-600">{coins.length}</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600">Coins Matching Filters</div>
              <div className="text-2xl font-bold text-green-600">{filteredCoins.length}</div>
            </div>
            <div className="bg-orange-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600">Volume Spikes Detected</div>
              <div className="text-2xl font-bold text-orange-600">{volumeSpikes.length}</div>
            </div>
          </div>
        </div>

        {/* Volume Spikes Alert */}
        {volumeSpikes.length > 0 && (
          <div className="bg-orange-50 border-l-4 border-orange-500 p-4 mb-6 rounded-lg">
            <div className="flex items-start">
              <AlertCircle className="w-5 h-5 text-orange-500 mt-0.5 mr-3" />
              <div className="flex-1">
                <h3 className="font-semibold text-orange-900">Recent Volume Spikes (&gt;{filters.volumeSpikeThreshold}% increase)</h3>
                <div className="mt-2 space-y-1">
                  {volumeSpikes.slice(0, 5).map((spike, i) => (
                    <div key={i} className="text-sm text-orange-800">
                      <span className="font-medium">{spike.name} ({spike.symbol})</span> - 
                      <span className="text-orange-600 font-bold"> +{spike.volumeIncrease}%</span> volume at {spike.timestamp}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Coins Table */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rank
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Coin
                  </th>
                  <th 
                    className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('price')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Price <SortIcon columnKey="price" />
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('market_cap')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Market Cap <SortIcon columnKey="market_cap" />
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('total_volume')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      24h Volume <SortIcon columnKey="total_volume" />
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('volume_to_mcap_ratio')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Vol/MCap % <SortIcon columnKey="volume_to_mcap_ratio" />
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('price_change_24h')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      24h Change <SortIcon columnKey="price_change_24h" />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sortedCoins.map((coin) => (
                  <tr key={coin.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      #{coin.rank}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {coin.image && <img src={coin.image} alt={coin.name} className="w-8 h-8 mr-3 rounded-full" />}
                        <div>
                          <div className="text-sm font-medium text-gray-900">{coin.name}</div>
                          <div className="text-sm text-gray-500">{coin.symbol.toUpperCase()}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                      ${coin.price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                      {formatNumber(coin.market_cap)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                      {formatNumber(coin.total_volume)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                      <span className={`px-2 py-1 rounded-full font-semibold ${
                        coin.volume_to_mcap_ratio >= 100 ? 'bg-orange-100 text-orange-800' :
                        coin.volume_to_mcap_ratio >= 50 ? 'bg-green-100 text-green-800' :
                        coin.volume_to_mcap_ratio >= 20 ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {coin.volume_to_mcap_ratio?.toFixed(1) || 0}%
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                      <span className={`font-semibold ${
                        coin.price_change_24h > 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {coin.price_change_24h > 0 ? '+' : ''}
                        {coin.price_change_24h?.toFixed(2) || 0}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {sortedCoins.length === 0 && !loading && coins.length > 0 && (
            <div className="text-center py-12 text-gray-500">
              <Filter className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p className="font-semibold">No coins match the current filters</p>
              <p className="text-sm mt-1">Try lowering the Min Vol/MCap % to 10-20%</p>
              <p className="text-xs mt-2 text-gray-400">
                Currently filtering from {coins.length} coins
              </p>
            </div>
          )}
          
          {coins.length === 0 && !loading && (
            <div className="text-center py-12 text-gray-500">
              <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p className="font-semibold">No data loaded</p>
              <p className="text-sm mt-1">
                Click the Refresh button to fetch coins
              </p>
            </div>
          )}
        </div>

        {/* Footer Info */}
        <div className="mt-6 text-center text-sm text-gray-600">
          <p>Data provided by CoinGecko API via local proxy • Cache TTL: 5 minutes</p>
          <p className="mt-1">Volume spikes detected when volume increases by &gt;{filters.volumeSpikeThreshold}% between refreshes</p>
          <p className="mt-1 text-xs text-gray-500">Vol/MCap % = (24h Volume / Market Cap) × 100</p>
          <p className="mt-2 text-xs text-gray-400">
            Single bulk API call per refresh • Rate limited with exponential backoff • Max 3 retries
          </p>
        </div>
      </div>
    </div>
  );
};

export default AltcoinMonitor;
