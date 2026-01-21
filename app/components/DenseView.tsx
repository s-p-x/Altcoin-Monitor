'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { TrendingUp, TrendingDown, ChevronUp, X } from 'lucide-react';

interface DenseViewProps {
  coins: any[];
  formatNumber: (num: number) => string;
  onSort: (key: string) => void;
  sortConfig: { key: string; direction: 'asc' | 'desc' };
  universeStats?: { total: number; filtered: number };
}

const DenseView: React.FC<DenseViewProps> = ({ 
  coins, 
  formatNumber, 
  onSort, 
  sortConfig,
  universeStats
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // Debounced search filtering
  const filteredCoins = useMemo(() => {
    if (!searchQuery.trim()) {
      return coins;
    }

    const query = searchQuery.toLowerCase().trim();
    
    return coins.filter(coin => {
      const symbol = (coin.symbol || coin.baseSymbol || '').toLowerCase();
      const name = (coin.name || '').toLowerCase();
      
      // Match symbol prefix or substring, name substring
      return (
        symbol.startsWith(query) || 
        symbol.includes(query) || 
        name.includes(query)
      );
    });
  }, [coins, searchQuery]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      handleClearSearch();
    }
  }, [handleClearSearch]);

  const SortIcon = ({ columnKey }: { columnKey: string }) => {
    if (sortConfig.key !== columnKey) return <span className="text-[var(--text-faint)] text-xs">⇅</span>;
    return <span className="text-[var(--accent)] text-xs">{sortConfig.direction === 'desc' ? '↓' : '↑'}</span>;
  };

  return (
    <div className="bg-[var(--panel)] rounded-lg border border-[var(--border)] overflow-hidden">
      {/* Search Bar */}
      <div className="p-4 border-b border-[var(--border)] bg-[var(--bg)]">
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="Search symbol or name…"
              value={searchQuery}
              onChange={handleSearchChange}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsSearching(true)}
              onBlur={() => setIsSearching(false)}
              className="w-full px-3 py-2 rounded border border-[var(--border)] bg-[var(--panel)] text-[var(--text)] text-sm placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
            />
            {searchQuery && (
              <button
                onClick={handleClearSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                title="Clear search (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="text-xs text-[var(--text-muted)] whitespace-nowrap">
            {filteredCoins.length} / {coins.length}
            {universeStats && process.env.NODE_ENV === 'development' && (
              <div className="text-xs text-[var(--text-faint)] mt-1">
                Universe: {universeStats.total}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-[var(--border)]">
          <thead className="bg-[var(--bg)] border-b border-[var(--border)]">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-[var(--text-faint)] uppercase tracking-wider">
                Rank
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-[var(--text-faint)] uppercase tracking-wider">
                Coin
              </th>
              <th
                className="px-4 py-2 text-right text-xs font-medium text-[var(--text-faint)] uppercase tracking-wider cursor-pointer hover:text-[var(--accent)]"
                onClick={() => onSort('price')}
              >
                <div className="flex items-center justify-end gap-1">
                  Price <SortIcon columnKey="price" />
                </div>
              </th>
              <th
                className="px-4 py-2 text-right text-xs font-medium text-[var(--text-faint)] uppercase tracking-wider cursor-pointer hover:text-[var(--accent)]"
                onClick={() => onSort('market_cap')}
              >
                <div className="flex items-center justify-end gap-1">
                  MCap <SortIcon columnKey="market_cap" />
                </div>
              </th>
              <th
                className="px-4 py-2 text-right text-xs font-medium text-[var(--text-faint)] uppercase tracking-wider cursor-pointer hover:text-[var(--accent)]"
                onClick={() => onSort('total_volume')}
              >
                <div className="flex items-center justify-end gap-1">
                  Vol <SortIcon columnKey="total_volume" />
                </div>
              </th>
              <th
                className="px-4 py-2 text-right text-xs font-medium text-[var(--text-faint)] uppercase tracking-wider cursor-pointer hover:text-[var(--accent)]"
                onClick={() => onSort('volume_to_mcap_ratio')}
              >
                <div className="flex items-center justify-end gap-1">
                  V/M% <SortIcon columnKey="volume_to_mcap_ratio" />
                </div>
              </th>
              <th
                className="px-4 py-2 text-right text-xs font-medium text-[var(--text-faint)] uppercase tracking-wider cursor-pointer hover:text-[var(--accent)]"
                onClick={() => onSort('price_change_24h')}
              >
                <div className="flex items-center justify-end gap-1">
                  24h% <SortIcon columnKey="price_change_24h" />
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {filteredCoins.map((coin) => (
              <tr key={coin.id} className="hover:bg-[var(--bg)] hover:border-l-2 hover:border-[var(--accent)] transition-all relative">
                <td className="px-4 py-2 whitespace-nowrap text-xs text-[var(--text-faint)] tabular-nums">
                  #{coin.rank}
                </td>
                <td className="px-4 py-2 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    {coin.image && (
                      <img
                        src={coin.image}
                        alt={coin.name}
                        className="w-5 h-5 rounded-full"
                      />
                    )}
                    <div>
                      <div className="text-xs font-medium text-[var(--text)]">
                        {coin.name}
                      </div>
                      <div className="text-xs text-[var(--text-muted)]">
                        {coin.symbol.toUpperCase()}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-2 whitespace-nowrap text-xs text-right text-[var(--text)] font-medium tabular-nums">
                  ${coin.price?.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 4
                  })}
                </td>
                <td className="px-4 py-2 whitespace-nowrap text-xs text-right text-[var(--text)] tabular-nums">
                  {formatNumber(coin.market_cap)}
                </td>
                <td className="px-4 py-2 whitespace-nowrap text-xs text-right text-[var(--text)] font-medium tabular-nums">
                  {formatNumber(coin.total_volume)}
                </td>
                <td className="px-4 py-2 whitespace-nowrap text-xs text-right">
                  <span
                    className={`px-1.5 py-0.5 rounded text-xs font-semibold border flex items-center justify-end gap-1 ${
                      coin.volume_to_mcap_ratio >= 100
                        ? 'bg-[var(--panel)] text-[var(--semantic-red)] border-[var(--semantic-red)]'
                        : coin.volume_to_mcap_ratio >= 50
                        ? 'bg-[var(--panel)] text-[var(--semantic-green)] border-[var(--semantic-green)]'
                        : coin.volume_to_mcap_ratio >= 20
                        ? 'bg-[var(--panel)] text-[var(--accent)] border-[var(--accent)]'
                        : 'bg-[var(--panel)] text-[var(--text-muted)] border-[var(--border)]'
                    }`}
                  >
                    {coin.volume_to_mcap_ratio >= 50 && <ChevronUp className="w-3 h-3" />}
                    {coin.volume_to_mcap_ratio?.toFixed(0) || 0}%
                  </span>
                </td>
                <td className="px-4 py-2 whitespace-nowrap text-xs text-right">
                  <span
                    className={`font-semibold flex items-center justify-end gap-0.5 tabular-nums ${
                      coin.price_change_24h > 0 ? 'text-[var(--semantic-green)]' : 'text-[var(--semantic-red)]'
                    }`}
                  >
                    {coin.price_change_24h > 0 ? (
                      <TrendingUp className="w-3 h-3" />
                    ) : (
                      <TrendingDown className="w-3 h-3" />
                    )}
                    {coin.price_change_24h > 0 ? '+' : ''}
                    {coin.price_change_24h?.toFixed(1) || 0}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DenseView;
