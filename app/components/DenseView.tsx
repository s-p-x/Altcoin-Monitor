'use client';

import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface DenseViewProps {
  coins: any[];
  formatNumber: (num: number) => string;
  onSort: (key: string) => void;
  sortConfig: { key: string; direction: 'asc' | 'desc' };
}

const DenseView: React.FC<DenseViewProps> = ({ coins, formatNumber, onSort, sortConfig }) => {
  const SortIcon = ({ columnKey }: { columnKey: string }) => {
    if (sortConfig.key !== columnKey) return <span className="text-[var(--text-faint)] text-xs">⇅</span>;
    return <span className="text-[var(--accent)] text-xs">{sortConfig.direction === 'desc' ? '↓' : '↑'}</span>;
  };

  return (
    <div className="bg-[var(--panel)] rounded-lg border border-[var(--border)] overflow-hidden">
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
            {coins.map((coin) => (
              <tr key={coin.id} className="hover:bg-[var(--bg)] transition-colors">
                <td className="px-4 py-2 whitespace-nowrap text-xs text-[var(--text-faint)]">
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
                <td className="px-4 py-2 whitespace-nowrap text-xs text-right text-[var(--text)] font-medium">
                  ${coin.price?.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 4
                  })}
                </td>
                <td className="px-4 py-2 whitespace-nowrap text-xs text-right text-[var(--text)]">
                  {formatNumber(coin.market_cap)}
                </td>
                <td className="px-4 py-2 whitespace-nowrap text-xs text-right text-[var(--text)] font-medium">
                  {formatNumber(coin.total_volume)}
                </td>
                <td className="px-4 py-2 whitespace-nowrap text-xs text-right">
                  <span
                    className={`px-1.5 py-0.5 rounded text-xs font-semibold border ${
                      coin.volume_to_mcap_ratio >= 100
                        ? 'bg-[var(--panel)] text-[var(--semantic-red)] border-[var(--semantic-red)]'
                        : coin.volume_to_mcap_ratio >= 50
                        ? 'bg-[var(--panel)] text-[var(--semantic-green)] border-[var(--semantic-green)]'
                        : coin.volume_to_mcap_ratio >= 20
                        ? 'bg-[var(--panel)] text-[var(--accent)] border-[var(--accent)]'
                        : 'bg-[var(--panel)] text-[var(--text-muted)] border-[var(--border)]'
                    }`}
                  >
                    {coin.volume_to_mcap_ratio?.toFixed(0) || 0}%
                  </span>
                </td>
                <td className="px-4 py-2 whitespace-nowrap text-xs text-right">
                  <span
                    className={`font-semibold flex items-center justify-end gap-0.5 ${
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
