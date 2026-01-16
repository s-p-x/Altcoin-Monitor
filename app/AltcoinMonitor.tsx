'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { TrendingUp, RefreshCw, Download, Bell, Filter, AlertCircle, CheckCircle, Key, Clock } from 'lucide-react';
import ViewToggle, { type ViewMode } from './components/ViewToggle';
import CardView from './components/CardView';
import DenseView from './components/DenseView';

const AltcoinMonitor = () => {
  const [coins, setCoins] = useState<any[]>([]);
  const [filteredCoins, setFilteredCoins] = useState<any[]>([]);
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
  const [volumeSpikes, setVolumeSpikes] = useState<any[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ 
    key: 'total_volume', 
    direction: 'desc' 
  });
  const [apiStatus, setApiStatus] = useState('idle');
  const [cacheExpiry, setCacheExpiry] = useState<number | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [openHelp, setOpenHelp] = useState<null | 'mcapMin' | 'mcapMax' | 'volRange' | 'volMcap' | 'spikeThreshold'>(null);
  const filterContainerRef = useRef<HTMLDivElement>(null);

  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  const MAX_RETRIES = 3;
  const BASE_BACKOFF = 1000; // 1 second

  // Load API key and view mode from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('coingeckoApiKey');
    if (stored) {
      setApiKey(stored);
      setApiKeySet(true);
    }
    
    const savedViewMode = localStorage.getItem('viewMode') as ViewMode | null;
    if (savedViewMode && ['table', 'cards', 'dense'].includes(savedViewMode)) {
      setViewMode(savedViewMode);
    }
  }, []);

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (filterContainerRef.current && !filterContainerRef.current.contains(e.target as Node)) {
        setOpenHelp(null);
      }
    };
    
    if (openHelp) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [openHelp]);

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
  const getBackoffDelay = (attempt: number) => {
    return BASE_BACKOFF * Math.pow(2, attempt);
  };

  // Fetch coin data with proper error handling and retries
  const fetchCoins = useCallback(async (forceRefresh = false) => {
    // Check cache first
    if (!forceRefresh && isCacheValid()) {
      console.log('📦 Using cached data (expires in', Math.round(((cacheExpiry || 0) - Date.now()) / 1000), 'seconds)');
      setDebugInfo({
        message: 'Using cached data',
        timestamp: new Date().toISOString(),
        cacheExpiry: new Date(cacheExpiry || 0).toISOString()
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
        const previousCoins = coins.reduce((acc: any, coin: any) => {
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
        const newSpikes: any[] = [];
        const processedData = result.map((coin: any) => {
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
          setError((err as any).message || 'Failed to fetch data after multiple attempts');
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
    let interval: NodeJS.Timeout | undefined;
    if (autoRefresh) {
      interval = setInterval(() => {
        if (!isCacheValid()) {
          fetchCoins(true);
        }
      }, 60000); // Check every minute
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, fetchCoins, cacheExpiry]);

  // Sort coins
  const sortedCoins = [...filteredCoins].sort((a, b) => {
    const aVal = a[sortConfig.key] || 0;
    const bVal = b[sortConfig.key] || 0;
    return sortConfig.direction === 'desc' ? (aVal < bVal ? 1 : -1) : (aVal > bVal ? 1 : -1);
  });

  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const handleViewModeChange = (newMode: ViewMode) => {
    setViewMode(newMode);
    localStorage.setItem('viewMode', newMode);
  };

  // Toggle help popover
  const toggleHelp = (helpId: 'mcapMin' | 'mcapMax' | 'volRange' | 'volMcap' | 'spikeThreshold') => {
    if (helpId === 'mcapMin' || helpId === 'mcapMax') {
      // Min/Max Market Cap open individually
      setOpenHelp(openHelp === helpId ? null : helpId);
    } else if (helpId === 'volRange') {
      // Min/Max Volume open together
      setOpenHelp(openHelp === 'volRange' ? null : 'volRange');
    } else {
      // Vol/MCap % and Spike Threshold open individually
      setOpenHelp(openHelp === helpId ? null : helpId);
    }
  };

  // Popover component
  const HelpPopover = ({ title, text }: { title: string; text: string }) => (
    <div className="absolute bottom-full left-0 mb-2 w-48 bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-lg z-50">
      <div className="text-sm text-gray-100">
        <div className="font-semibold text-white mb-1">{title}</div>
        <div className="text-gray-300">{text}</div>
      </div>
      <div className="absolute top-full left-3 w-2 h-2 bg-gray-900 border-r border-b border-gray-700 transform rotate-45"></div>
    </div>
  );

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

  const formatNumber = (num: number): string => {
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
    return `$${num?.toFixed(2) || 0}`;
  };

  const SortIcon = ({ columnKey }: { columnKey: string }) => {
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
    <div className="min-h-screen bg-[var(--bg)] p-6">
      <div className="max-w-7xl mx-auto">
        {/* API Key Setup */}
        {!apiKeySet && (
          <div className="bg-[var(--panel)] border-l-4 border-[var(--accent)] rounded-lg p-6 mb-6">
            <div className="flex items-start gap-3">
              <Key className="w-6 h-6 text-[var(--accent)] mt-1" />
              <div className="flex-1">
                <h3 className="font-semibold text-[var(--text)] mb-2">CoinGecko API Key (Optional)</h3>
                <p className="text-sm text-[var(--text-muted)] mb-4">
                  This app uses the free CoinGecko API by default. For higher rate limits, enter your API key from{' '}
                  <a href="https://www.coingecko.com/en/api/pricing" target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] underline hover:text-white">
                    coingecko.com/api/pricing
                  </a>
                </p>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Enter your API key (optional)..."
                    className="flex-1 px-3 py-2 border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] rounded-lg placeholder-[var(--text-faint)] focus:outline-none focus:border-[var(--accent)]"
                    onKeyPress={(e) => e.key === 'Enter' && saveApiKey()}
                  />
                  <button
                    onClick={saveApiKey}
                    className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:bg-opacity-80 border border-[var(--accent)] transition-all"
                  >
                    Save Key
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="bg-[var(--panel)] rounded-lg border border-[var(--border)] p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-[var(--text)] flex items-center gap-2">
                <TrendingUp className="w-8 h-8 text-[var(--accent)]" />
                Altcoin Volume Monitor
              </h1>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <p className="text-[var(--text-muted)]">
                    {lastUpdate && `Last updated: ${lastUpdate.toLocaleTimeString()}`}
                  </p>
                  {cacheExpiry && isCacheValid() && (
                    <span className="flex items-center gap-1 text-[var(--accent)] text-sm">
                      <Clock className="w-4 h-4" /> Cache: {getCacheTimeRemaining()}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {apiStatus === 'success' && (
                    <div className="flex items-center gap-2 px-3 py-1 bg-green-900 bg-opacity-30 border border-green-700 rounded-full">
                      <img 
                        src="/connected.svg" 
                        alt="Connected" 
                        className="w-6 h-6" 
                        style={{ imageRendering: 'pixelated' }}
                        onError={(e) => {
                          // Fallback to a simple green dot if sprite fails to load
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                      <span className="text-[var(--semantic-green)] text-sm font-medium">API Connected</span>
                    </div>
                  )}
                  {apiStatus === 'error' && (
                    <div className="flex items-center gap-2 px-3 py-1 bg-red-900 bg-opacity-30 border border-red-700 rounded-full">
                      <div className="w-4 h-4 bg-[var(--semantic-red)] rounded-full"></div>
                      <span className="text-[var(--semantic-red)] text-sm font-medium">API Error</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-3 flex-wrap items-start">
              <ViewToggle viewMode={viewMode} onChange={handleViewModeChange} />
              {apiKeySet && (
                <button
                  onClick={clearApiKey}
                  className="px-3 py-2 bg-[var(--panel)] text-[var(--text-muted)] rounded-lg hover:text-[var(--text)] border border-[var(--border)] hover:border-[var(--accent)] text-sm transition-all"
                >
                  Change API Key
                </button>
              )}
              <button
                onClick={() => fetchCoins(true)}
                disabled={loading}
                className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:bg-opacity-80 disabled:bg-[var(--text-faint)] disabled:text-[var(--text-muted)] flex items-center gap-2 border border-[var(--accent)] transition-all"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                {loading ? 'Loading...' : 'Refresh'}
              </button>
              <button
                onClick={exportToCSV}
                disabled={sortedCoins.length === 0}
                className="px-4 py-2 bg-[var(--panel)] text-[var(--semantic-green)] rounded-lg hover:bg-opacity-80 disabled:text-[var(--text-faint)] flex items-center gap-2 border border-[var(--semantic-green)] disabled:border-[var(--border)] transition-all"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all border ${
                  autoRefresh ? 'bg-[var(--panel)] text-[var(--semantic-red)] border-[var(--semantic-red)]' : 'bg-[var(--panel)] text-[var(--text-muted)] border-[var(--border)] hover:border-[var(--accent)]'
                }`}
              >
                <Bell className="w-4 h-4" />
                Auto {autoRefresh ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-[var(--panel)] border-l-4 border-[var(--semantic-red)] rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-[var(--semantic-red)] mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-[var(--semantic-red)]">Error</p>
                  <p className="text-sm text-[var(--text-muted)]">{error}</p>
                  {retryCount > 0 && (
                    <p className="text-xs text-[var(--text-faint)] mt-1">Failed after {retryCount} attempts</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Debug Info */}
          {debugInfo && (
            <details className="mb-4 p-3 bg-[var(--bg)] rounded-lg text-xs border border-[var(--border)]">
              <summary className="cursor-pointer font-semibold text-[var(--text-muted)]">Debug Info</summary>
              <pre className="mt-2 overflow-x-auto text-[var(--text-faint)]">
                {JSON.stringify(debugInfo, null, 2)}
              </pre>
            </details>
          )}

          {/* Filters */}
          <div className="grid grid-cols-5 gap-4 p-4 bg-[var(--bg)] rounded-lg border border-[var(--border)]" ref={filterContainerRef}>
            {/* Min Market Cap */}
            <div className="relative">
              <label 
                className="block text-sm font-medium text-[var(--text-muted)] mb-1 cursor-help hover:text-[var(--text)] transition-colors"
                onClick={() => toggleHelp('mcapMin')}
              >
                Min Market Cap
              </label>
              <input
                type="number"
                value={filters.minMarketCap}
                onChange={(e) => setFilters({ ...filters, minMarketCap: parseFloat(e.target.value) || 0 })}
                onClick={() => toggleHelp('mcapMin')}
                className="w-full px-3 py-2 border border-[var(--border)] bg-[var(--panel)] text-[var(--text)] rounded-lg text-sm focus:outline-none focus:border-[var(--accent)] cursor-help"
              />
              {openHelp === 'mcapMin' && (
                <HelpPopover 
                  title="Min Market Cap" 
                  text="Hide microcaps. Only show coins above this market cap."
                />
              )}
              <span className="text-xs text-[var(--text-faint)]">
                {formatNumber(filters.minMarketCap)}
              </span>
            </div>

            {/* Max Market Cap */}
            <div className="relative">
              <label 
                className="block text-sm font-medium text-[var(--text-muted)] mb-1 cursor-help hover:text-[var(--text)] transition-colors"
                onClick={() => toggleHelp('mcapMax')}
              >
                Max Market Cap
              </label>
              <input
                type="number"
                value={filters.maxMarketCap}
                onChange={(e) => setFilters({ ...filters, maxMarketCap: parseFloat(e.target.value) || 0 })}
                onClick={() => toggleHelp('mcapMax')}
                className="w-full px-3 py-2 border border-[var(--border)] bg-[var(--panel)] text-[var(--text)] rounded-lg text-sm focus:outline-none focus:border-[var(--accent)] cursor-help"
              />
              {openHelp === 'mcapMax' && (
                <HelpPopover 
                  title="Max Market Cap" 
                  text="Hide large caps. Only show coins below this market cap."
                />
              )}
              <span className="text-xs text-[var(--text-faint)]">
                {formatNumber(filters.maxMarketCap)}
              </span>
            </div>

            {/* Min/Max Volume (Combined) */}
            <div className="relative">
              <label 
                className="block text-sm font-medium text-[var(--text-muted)] mb-1 cursor-help hover:text-[var(--text)] transition-colors"
                onClick={() => toggleHelp('volRange')}
              >
                Min Volume (24h)
              </label>
              <input
                type="number"
                value={filters.minVolume}
                onChange={(e) => setFilters({ ...filters, minVolume: parseFloat(e.target.value) || 0 })}
                onClick={() => toggleHelp('volRange')}
                className="w-full px-3 py-2 border border-[var(--border)] bg-[var(--panel)] text-[var(--text)] rounded-lg text-sm focus:outline-none focus:border-[var(--accent)] cursor-help"
              />
              {openHelp === 'volRange' && (
                <HelpPopover 
                  title="Volume Range (24h)" 
                  text="Only show coins whose 24h volume is within this range."
                />
              )}
              <span className="text-xs text-[var(--text-faint)]">
                {formatNumber(filters.minVolume)}
              </span>
            </div>

            {/* Min Vol/MCap % */}
            <div className="relative">
              <label 
                className="block text-sm font-medium text-[var(--text-muted)] mb-1 cursor-help hover:text-[var(--text)] transition-colors"
                onClick={() => toggleHelp('volMcap')}
              >
                Min Vol/MCap %
              </label>
              <input
                type="number"
                value={filters.minVolumeChange}
                onChange={(e) => setFilters({ ...filters, minVolumeChange: parseFloat(e.target.value) || 0 })}
                onClick={() => toggleHelp('volMcap')}
                className="w-full px-3 py-2 border border-[var(--border)] bg-[var(--panel)] text-[var(--text)] rounded-lg text-sm focus:outline-none focus:border-[var(--accent)] cursor-help"
              />
              {openHelp === 'volMcap' && (
                <HelpPopover 
                  title="Min Vol/MCap %" 
                  text="Liquidity filter. Higher % means volume is large relative to market cap."
                />
              )}
              <span className="text-xs text-[var(--text-faint)]">
                {filters.minVolumeChange}%
              </span>
            </div>

            {/* Spike Threshold % */}
            <div className="relative">
              <label 
                className="block text-sm font-medium text-[var(--text-muted)] mb-1 cursor-help hover:text-[var(--text)] transition-colors"
                onClick={() => toggleHelp('spikeThreshold')}
              >
                Spike Threshold %
              </label>
              <input
                type="number"
                value={filters.volumeSpikeThreshold}
                onChange={(e) => setFilters({ ...filters, volumeSpikeThreshold: parseFloat(e.target.value) || 0 })}
                onClick={() => toggleHelp('spikeThreshold')}
                className="w-full px-3 py-2 border border-[var(--border)] bg-[var(--panel)] text-[var(--text)] rounded-lg text-sm focus:outline-none focus:border-[var(--accent)] cursor-help"
              />
              {openHelp === 'spikeThreshold' && (
                <HelpPopover 
                  title="Spike Threshold %" 
                  text="Flag coins when 24h volume jumps by this % since last refresh."
                />
              )}
              <span className="text-xs text-[var(--text-faint)]">
                {filters.volumeSpikeThreshold}%
              </span>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mt-4">
            <div className="bg-[var(--bg)] p-4 rounded-lg border border-[var(--accent)] border-opacity-30">
              <div className="text-sm text-[var(--text-muted)]">Total Coins Fetched</div>
              <div className="text-2xl font-bold text-[var(--accent)]">{coins.length}</div>
            </div>
            <div className="bg-[var(--bg)] p-4 rounded-lg border border-[var(--semantic-green)] border-opacity-30">
              <div className="text-sm text-[var(--text-muted)]">Coins Matching Filters</div>
              <div className="text-2xl font-bold text-[var(--semantic-green)]">{filteredCoins.length}</div>
            </div>
            <div className="bg-[var(--bg)] p-4 rounded-lg border border-[var(--semantic-red)] border-opacity-30">
              <div className="text-sm text-[var(--text-muted)]">Volume Spikes Detected</div>
              <div className="text-2xl font-bold text-[var(--semantic-red)]">{volumeSpikes.length}</div>
            </div>
          </div>
        </div>

        {/* Volume Spikes Alert */}
        {volumeSpikes.length > 0 && (
          <div className="bg-[var(--panel)] border-l-4 border-[var(--semantic-red)] p-4 mb-6 rounded-lg">
            <div className="flex items-start">
              <AlertCircle className="w-5 h-5 text-[var(--semantic-red)] mt-0.5 mr-3" />
              <div className="flex-1">
                <h3 className="font-semibold text-[var(--text)]">Recent Volume Spikes (&gt;{filters.volumeSpikeThreshold}% increase)</h3>
                <div className="mt-2 space-y-1">
                  {volumeSpikes.slice(0, 5).map((spike, i) => (
                    <div key={i} className="text-sm text-[var(--text-muted)]">
                      <span className="font-medium text-[var(--text)]">{spike.name} ({spike.symbol})</span> - 
                      <span className="text-[var(--semantic-red)] font-bold"> +{spike.volumeIncrease}%</span> volume at {spike.timestamp}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Coins Display - Dynamic View */}
        {viewMode === 'table' && (
          <div className="bg-[var(--panel)] rounded-lg border border-[var(--border)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-[var(--border)]">
                <thead className="bg-[var(--bg)] border-b border-[var(--border)]">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text-faint)] uppercase tracking-wider">
                      Rank
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text-faint)] uppercase tracking-wider">
                      Coin
                    </th>
                    <th 
                      className="px-6 py-3 text-right text-xs font-medium text-[var(--text-faint)] uppercase tracking-wider cursor-pointer hover:text-[var(--accent)]"
                      onClick={() => handleSort('price')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Price <SortIcon columnKey="price" />
                      </div>
                    </th>
                    <th 
                      className="px-6 py-3 text-right text-xs font-medium text-[var(--text-faint)] uppercase tracking-wider cursor-pointer hover:text-[var(--accent)]"
                      onClick={() => handleSort('market_cap')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Market Cap <SortIcon columnKey="market_cap" />
                      </div>
                    </th>
                    <th 
                      className="px-6 py-3 text-right text-xs font-medium text-[var(--text-faint)] uppercase tracking-wider cursor-pointer hover:text-[var(--accent)]"
                      onClick={() => handleSort('total_volume')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        24h Volume <SortIcon columnKey="total_volume" />
                      </div>
                    </th>
                    <th 
                      className="px-6 py-3 text-right text-xs font-medium text-[var(--text-faint)] uppercase tracking-wider cursor-pointer hover:text-[var(--accent)]"
                      onClick={() => handleSort('volume_to_mcap_ratio')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Vol/MCap % <SortIcon columnKey="volume_to_mcap_ratio" />
                      </div>
                    </th>
                    <th 
                      className="px-6 py-3 text-right text-xs font-medium text-[var(--text-faint)] uppercase tracking-wider cursor-pointer hover:text-[var(--accent)]"
                      onClick={() => handleSort('price_change_24h')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        24h Change <SortIcon columnKey="price_change_24h" />
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {sortedCoins.map((coin) => (
                    <tr key={coin.id} className="hover:bg-[var(--bg)] transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--text-faint)]">
                        #{coin.rank}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {coin.image && <img src={coin.image} alt={coin.name} className="w-8 h-8 mr-3 rounded-full" />}
                          <div>
                            <div className="text-sm font-medium text-[var(--text)]">{coin.name}</div>
                            <div className="text-sm text-[var(--text-muted)]">{coin.symbol.toUpperCase()}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-[var(--text)]">
                        ${coin.price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-[var(--text)]">
                        {formatNumber(coin.market_cap)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-[var(--text)]">
                        {formatNumber(coin.total_volume)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                        <span className={`px-2 py-1 rounded-full font-semibold border ${
                          coin.volume_to_mcap_ratio >= 100 ? 'bg-[var(--panel)] text-[var(--semantic-red)] border-[var(--semantic-red)]' :
                          coin.volume_to_mcap_ratio >= 50 ? 'bg-[var(--panel)] text-[var(--semantic-green)] border-[var(--semantic-green)]' :
                          coin.volume_to_mcap_ratio >= 20 ? 'bg-[var(--panel)] text-[var(--accent)] border-[var(--accent)]' :
                          'bg-[var(--panel)] text-[var(--text-muted)] border-[var(--border)]'
                        }`}>
                          {coin.volume_to_mcap_ratio?.toFixed(1) || 0}%
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                        <span className={`font-semibold ${
                          coin.price_change_24h > 0 ? 'text-[var(--semantic-green)]' : 'text-[var(--semantic-red)]'
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
              <div className="text-center py-12 text-[var(--text-muted)]">
                <Filter className="w-12 h-12 mx-auto mb-3 text-[var(--text-faint)]" />
                <p className="font-semibold">No coins match the current filters</p>
                <p className="text-sm mt-1">Try lowering the Min Vol/MCap % to 10-20%</p>
                <p className="text-xs mt-2 text-[var(--text-faint)]">
                  Currently filtering from {coins.length} coins
                </p>
              </div>
            )}
            
            {coins.length === 0 && !loading && (
              <div className="text-center py-12 text-[var(--text-muted)]">
                <AlertCircle className="w-12 h-12 mx-auto mb-3 text-[var(--text-faint)]" />
                <p className="font-semibold">No data loaded</p>
                <p className="text-sm mt-1">
                  Click the Refresh button to fetch coins
                </p>
              </div>
            )}
          </div>
        )}

        {viewMode === 'cards' && (
          <div>
            {sortedCoins.length > 0 ? (
              <CardView coins={sortedCoins} formatNumber={formatNumber} />
            ) : (
              <div className="bg-[var(--panel)] rounded-lg border border-[var(--border)] p-12 text-center text-[var(--text-muted)]">
                {coins.length === 0 && !loading ? (
                  <>
                    <AlertCircle className="w-12 h-12 mx-auto mb-3 text-[var(--text-faint)]" />
                    <p className="font-semibold">No data loaded</p>
                    <p className="text-sm mt-1">
                      Click the Refresh button to fetch coins
                    </p>
                  </>
                ) : (
                  <>
                    <Filter className="w-12 h-12 mx-auto mb-3 text-[var(--text-faint)]" />
                    <p className="font-semibold">No coins match the current filters</p>
                    <p className="text-sm mt-1">Try lowering the Min Vol/MCap % to 10-20%</p>
                    <p className="text-xs mt-2 text-[var(--text-faint)]">
                      Currently filtering from {coins.length} coins
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {viewMode === 'dense' && (
          <div>
            {sortedCoins.length > 0 ? (
              <DenseView coins={sortedCoins} formatNumber={formatNumber} onSort={handleSort} sortConfig={sortConfig} />
            ) : (
              <div className="bg-[var(--panel)] rounded-lg border border-[var(--border)] p-12 text-center text-[var(--text-muted)]">
                {coins.length === 0 && !loading ? (
                  <>
                    <AlertCircle className="w-12 h-12 mx-auto mb-3 text-[var(--text-faint)]" />
                    <p className="font-semibold">No data loaded</p>
                    <p className="text-sm mt-1">
                      Click the Refresh button to fetch coins
                    </p>
                  </>
                ) : (
                  <>
                    <Filter className="w-12 h-12 mx-auto mb-3 text-[var(--text-faint)]" />
                    <p className="font-semibold">No coins match the current filters</p>
                    <p className="text-sm mt-1">Try lowering the Min Vol/MCap % to 10-20%</p>
                    <p className="text-xs mt-2 text-[var(--text-faint)]">
                      Currently filtering from {coins.length} coins
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Footer Info */}
        <div className="mt-6 text-center text-sm text-[var(--text-muted)]">
          <p>Data provided by CoinGecko API via local proxy • Cache TTL: 5 minutes</p>
          <p className="mt-1">Volume spikes detected when volume increases by &gt;{filters.volumeSpikeThreshold}% between refreshes</p>
          <p className="mt-1 text-xs text-[var(--text-faint)]">Vol/MCap % = (24h Volume / Market Cap) × 100</p>
          <p className="mt-2 text-xs text-[var(--text-faint)]">
            Single bulk API call per refresh • Rate limited with exponential backoff • Max 3 retries
          </p>
        </div>
      </div>
    </div>
  );
};

export default AltcoinMonitor;
