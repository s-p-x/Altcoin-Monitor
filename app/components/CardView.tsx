'use client';

import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface CardViewProps {
  coins: any[];
  formatNumber: (num: number) => string;
}

const CardView: React.FC<CardViewProps> = ({ coins, formatNumber }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {coins.map((coin) => (
        <div
          key={coin.id}
          className="bg-[var(--panel)] rounded-lg border border-[var(--border)] hover:border-[var(--accent)] transition-colors p-4"
        >
          {/* Coin Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3 flex-1">
              {coin.image && (
                <img
                  src={coin.image}
                  alt={coin.name}
                  className="w-10 h-10 rounded-full"
                />
              )}
              <div className="min-w-0">
                <div className="text-sm font-semibold text-[var(--text)] truncate">
                  {coin.name}
                </div>
                <div className="text-xs text-[var(--text-faint)]">
                  #{coin.rank}
                </div>
              </div>
            </div>
            <div className="text-right ml-2">
              <div className="text-xs font-medium text-[var(--text-muted)]">
                {coin.symbol.toUpperCase()}
              </div>
            </div>
          </div>

          {/* Price */}
          <div className="mb-3 pb-3 border-b border-[var(--border)]">
            <div className="text-2xl font-bold text-[var(--text)]">
              ${coin.price?.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 6
              })}
            </div>
            <div className={`text-sm font-semibold flex items-center gap-1 ${
              coin.price_change_24h > 0 ? 'text-[var(--semantic-green)]' : 'text-[var(--semantic-red)]'
            }`}>
              {coin.price_change_24h > 0 ? (
                <TrendingUp className="w-4 h-4" />
              ) : (
                <TrendingDown className="w-4 h-4" />
              )}
              {coin.price_change_24h > 0 ? '+' : ''}
              {coin.price_change_24h?.toFixed(2) || 0}%
            </div>
          </div>

          {/* Stats Grid */}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Market Cap</span>
              <span className="font-medium text-[var(--text)]">
                {formatNumber(coin.market_cap)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">24h Volume</span>
              <span className="font-medium text-[var(--text)]">
                {formatNumber(coin.total_volume)}
              </span>
            </div>
            <div className="flex justify-between pt-2 border-t border-[var(--border)]">
              <span className="text-[var(--text-muted)]">Vol/MCap</span>
              <span
                className={`px-2 py-1 rounded font-semibold text-xs border ${
                  coin.volume_to_mcap_ratio >= 100
                    ? 'bg-[var(--panel)] text-[var(--semantic-red)] border-[var(--semantic-red)]'
                    : coin.volume_to_mcap_ratio >= 50
                    ? 'bg-[var(--panel)] text-[var(--semantic-green)] border-[var(--semantic-green)]'
                    : coin.volume_to_mcap_ratio >= 20
                    ? 'bg-[var(--panel)] text-[var(--accent)] border-[var(--accent)]'
                    : 'bg-[var(--panel)] text-[var(--text-muted)] border-[var(--border)]'
                }`}
              >
                {coin.volume_to_mcap_ratio?.toFixed(1) || 0}%
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default CardView;
