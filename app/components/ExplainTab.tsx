'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, AlertCircle, Sparkles } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ExplainTabProps {
  universeCoins: any[];
}

const ExplainTab: React.FC<ExplainTabProps> = ({ universeCoins }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Match ticker against universe
  const findCoinMatch = (ticker: string) => {
    const query = ticker.trim().toUpperCase();
    if (!query || universeCoins.length === 0) return null;

    // Exact symbol match (case-insensitive)
    const exactMatch = universeCoins.find(
      (coin) => coin.symbol?.toUpperCase() === query
    );
    if (exactMatch) return exactMatch;

    // Fallback: name contains query
    const nameMatch = universeCoins.find((coin) =>
      coin.name?.toUpperCase().includes(query)
    );
    return nameMatch || null;
  };

  const handleSend = async () => {
    const trimmedInput = input.trim();
    if (!trimmedInput || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: trimmedInput,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setError(null);

    try {
      // Attempt to match ticker against universe
      const matchedCoin = findCoinMatch(trimmedInput);

      const response = await fetch('/api/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: trimmedInput,
          matchedCoin: matchedCoin
            ? {
                id: matchedCoin.id,
                symbol: matchedCoin.symbol,
                name: matchedCoin.name,
                market_cap: matchedCoin.market_cap,
                total_volume: matchedCoin.total_volume,
                current_price: matchedCoin.current_price,
                coingecko_url: `https://www.coingecko.com/en/coins/${matchedCoin.id}`,
              }
            : null,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const data = await response.json();

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      setError(err.message || 'Failed to get response');
      console.error('Explain API error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="bg-[var(--panel)] rounded-md border border-[var(--border)] p-6 flex flex-col h-[calc(100vh-300px)]">
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-[var(--text)] flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-[var(--accent)]" />
          Coin Explainer
        </h2>
        <p className="text-[var(--text-muted)] text-sm mt-1">
          Get a structured, honest evaluation of any coin. Just enter a ticker.
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto mb-4 space-y-4 min-h-0">
        {messages.length === 0 && (
          <div className="text-center py-12 text-[var(--text-muted)]">
            <Sparkles className="w-12 h-12 mx-auto mb-3 text-[var(--text-faint)] opacity-50" />
            <p className="font-semibold">No conversations yet</p>
            <p className="text-sm mt-1">Enter a ticker like SOL, ETH, or PEPE to get started</p>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`p-4 rounded-md border ${
              msg.role === 'user'
                ? 'bg-[var(--accent)] bg-opacity-10 border-[var(--accent)] ml-12'
                : 'bg-[var(--bg)] border-[var(--border)] mr-12'
            }`}
          >
            <div className="flex items-start justify-between mb-2">
              <span className="text-xs font-semibold text-[var(--text-muted)] uppercase">
                {msg.role === 'user' ? 'You' : 'AI Analyst'}
              </span>
              <span className="text-xs text-[var(--text-faint)]">
                {msg.timestamp.toLocaleTimeString()}
              </span>
            </div>
            <div className="text-[var(--text)] whitespace-pre-wrap leading-relaxed">
              {msg.content}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="p-4 rounded-md border bg-[var(--bg)] border-[var(--border)] mr-12">
            <div className="flex items-center gap-2 text-[var(--text-muted)]">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Analyzing...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-3 bg-[var(--semantic-red)] bg-opacity-10 border border-[var(--semantic-red)] rounded-md flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-[var(--semantic-red)] mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-[var(--semantic-red)] font-semibold">Error</p>
            <p className="text-sm text-[var(--text-muted)] mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter ticker (e.g., SOL)…"
          disabled={isLoading}
          className="flex-1 px-4 py-3 border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] rounded-md text-sm focus:outline-none focus:border-[var(--accent)] disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || isLoading}
          className="px-6 py-3 bg-[var(--accent)] text-white rounded-md hover:bg-opacity-90 disabled:bg-[var(--text-faint)] disabled:bg-opacity-20 disabled:text-[var(--text-faint)] flex items-center gap-2 border border-[var(--accent)] disabled:border-[var(--border)] transition-all font-medium"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          Send
        </button>
      </div>
    </div>
  );
};

export default ExplainTab;
