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
          className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow border border-gray-200 p-4"
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
                <div className="text-sm font-semibold text-gray-900 truncate">
                  {coin.name}
                </div>
                <div className="text-xs text-gray-500">
                  #{coin.rank}
                </div>
              </div>
            </div>
            <div className="text-right ml-2">
              <div className="text-xs font-medium text-gray-600">
                {coin.symbol.toUpperCase()}
              </div>
            </div>
          </div>

          {/* Price */}
          <div className="mb-3 pb-3 border-b border-gray-100">
            <div className="text-2xl font-bold text-gray-900">
              ${coin.price?.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 6
              })}
            </div>
            <div className={`text-sm font-semibold flex items-center gap-1 ${
              coin.price_change_24h > 0 ? 'text-green-600' : 'text-red-600'
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
              <span className="text-gray-600">Market Cap</span>
              <span className="font-medium text-gray-900">
                {formatNumber(coin.market_cap)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">24h Volume</span>
              <span className="font-medium text-gray-900">
                {formatNumber(coin.total_volume)}
              </span>
            </div>
            <div className="flex justify-between pt-2 border-t border-gray-100">
              <span className="text-gray-600">Vol/MCap</span>
              <span
                className={`px-2 py-1 rounded font-semibold text-xs ${
                  coin.volume_to_mcap_ratio >= 100
                    ? 'bg-orange-100 text-orange-800'
                    : coin.volume_to_mcap_ratio >= 50
                    ? 'bg-green-100 text-green-800'
                    : coin.volume_to_mcap_ratio >= 20
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-gray-100 text-gray-800'
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
