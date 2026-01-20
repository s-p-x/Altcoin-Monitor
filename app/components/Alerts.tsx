"use client";

import { useState, useRef, useEffect } from "react";
import {
  AlertCircle,
  Clock,
  TrendingUp,
  Zap,
  Trash2,
  Plus,
  ChevronDown,
  CheckCircle,
  X,
} from "lucide-react";
import { AlertRule, AlertEvent } from "@/lib/types";

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
const DEFAULT_USER_ID = "demo_user"; // TODO: Replace with actual auth

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
  const [activeTab, setActiveTab] = useState<"rules" | "events">("rules");

  // Alert Rules state
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [rulesLoading, setRulesLoading] = useState(false);

  // Create Rule form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    symbol: "",
    timeframes: ["1h"],
    thresholds: [2, 3],
    baseline_n: 20,
    cooldown_seconds: 300,
  });
  const [formLoading, setFormLoading] = useState(false);

  // Alert Events state
  const [events, setEvents] = useState<AlertEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsPollInterval, setEventsPollInterval] = useState<NodeJS.Timeout | null>(null);

  // Fetch rules
  const fetchRules = async () => {
    setRulesLoading(true);
    try {
      const params = new URLSearchParams({ userId: DEFAULT_USER_ID });
      const res = await fetch(`/api/alerts/rules?${params}`);
      if (!res.ok) throw new Error("Failed to fetch rules");
      const data = await res.json();
      setRules(data.rules || []);
    } catch (err: any) {
      console.error("Failed to fetch rules:", err);
    } finally {
      setRulesLoading(false);
    }
  };

  // Fetch events
  const fetchEvents = async () => {
    setEventsLoading(true);
    try {
      const params = new URLSearchParams({
        userId: DEFAULT_USER_ID,
        limit: "50",
      });
      const res = await fetch(`/api/alerts/events?${params}`);
      if (!res.ok) throw new Error("Failed to fetch events");
      const data = await res.json();
      setEvents(data.events || []);
    } catch (err: any) {
      console.error("Failed to fetch events:", err);
    } finally {
      setEventsLoading(false);
    }
  };

  // Load rules and events on mount
  useEffect(() => {
    fetchRules();
    fetchEvents();

    // Poll for new events every 5 seconds
    const interval = setInterval(fetchEvents, 5000);
    setEventsPollInterval(interval);

    return () => {
      if (interval) clearInterval(interval);
    };
  }, []);

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.symbol.trim()) {
      alert("Please enter a symbol");
      return;
    }

    setFormLoading(true);
    try {
      const res = await fetch("/api/alerts/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: DEFAULT_USER_ID,
          symbol: formData.symbol.toUpperCase(),
          timeframes: formData.timeframes,
          thresholds: formData.thresholds,
          baseline_n: formData.baseline_n,
          cooldown_seconds: formData.cooldown_seconds,
        }),
      });

      if (!res.ok) throw new Error("Failed to create rule");

      // Reset form and refresh
      setFormData({
        symbol: "",
        timeframes: ["1h"],
        thresholds: [2, 3],
        baseline_n: 20,
        cooldown_seconds: 300,
      });
      setShowCreateForm(false);
      await fetchRules();
    } catch (err: any) {
      console.error("Failed to create rule:", err);
      alert("Failed to create rule: " + err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!confirm("Delete this rule?")) return;

    try {
      const params = new URLSearchParams({ id: ruleId });
      const res = await fetch(`/api/alerts/rules?${params}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete rule");
      await fetchRules();
    } catch (err: any) {
      console.error("Failed to delete rule:", err);
      alert("Failed to delete rule: " + err.message);
    }
  };

  const handleToggleRule = async (rule: AlertRule) => {
    try {
      const res = await fetch("/api/alerts/rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...rule,
          enabled: !rule.enabled,
        }),
      });

      if (!res.ok) throw new Error("Failed to update rule");
      await fetchRules();
    } catch (err: any) {
      console.error("Failed to toggle rule:", err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-[var(--border)]">
        <button
          onClick={() => setActiveTab("rules")}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === "rules"
              ? "text-[var(--accent)] border-b-[var(--accent)]"
              : "text-[var(--text-muted)] border-b-transparent hover:text-[var(--text)]"
          }`}
        >
          <div className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Rules
          </div>
        </button>
        <button
          onClick={() => setActiveTab("events")}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === "events"
              ? "text-[var(--accent)] border-b-[var(--accent)]"
              : "text-[var(--text-muted)] border-b-transparent hover:text-[var(--text)]"
          }`}
        >
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Events
          </div>
        </button>
      </div>

      {/* Rules Tab */}
      {activeTab === "rules" && (
        <div className="space-y-4">
          {/* Create Rule Form */}
          {!showCreateForm ? (
            <button
              onClick={() => setShowCreateForm(true)}
              className="w-full px-4 py-3 bg-[var(--accent)] bg-opacity-10 text-[var(--accent)] border border-[var(--accent)] border-opacity-30 rounded-md hover:bg-opacity-20 transition-colors font-medium flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Create New Rule
            </button>
          ) : (
            <div className="p-4 bg-[var(--panel)] border border-[var(--border)] rounded-md">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-[var(--text)]">
                  Create Volume Spike Alert Rule
                </h3>
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="text-[var(--text-muted)] hover:text-[var(--text)]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateRule} className="space-y-4">
                {/* Symbol Input */}
                <div>
                  <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">
                    Coin Symbol
                  </label>
                  <input
                    type="text"
                    value={formData.symbol}
                    onChange={(e) =>
                      setFormData({ ...formData, symbol: e.target.value })
                    }
                    placeholder="e.g., BTC, ETH, SOL"
                    className="w-full px-3 py-2 border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] rounded-md text-sm focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>

                {/* Timeframes */}
                <div>
                  <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">
                    Timeframes
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {TIMEFRAMES.map((tf) => (
                      <label key={tf} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={formData.timeframes.includes(tf)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({
                                ...formData,
                                timeframes: [...formData.timeframes, tf],
                              });
                            } else {
                              setFormData({
                                ...formData,
                                timeframes: formData.timeframes.filter(
                                  (t) => t !== tf
                                ),
                              });
                            }
                          }}
                          className="w-4 h-4 rounded"
                        />
                        <span className="text-sm text-[var(--text)]">{tf}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Thresholds */}
                <div>
                  <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">
                    Thresholds (2x, 3x)
                  </label>
                  <div className="flex gap-3">
                    {[2, 3].map((mult) => (
                      <label key={mult} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={formData.thresholds.includes(mult)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({
                                ...formData,
                                thresholds: [
                                  ...formData.thresholds,
                                  mult,
                                ].sort(),
                              });
                            } else {
                              setFormData({
                                ...formData,
                                thresholds: formData.thresholds.filter(
                                  (t) => t !== mult
                                ),
                              });
                            }
                          }}
                          className="w-4 h-4 rounded"
                        />
                        <span className="text-sm text-[var(--text)]">
                          {mult}×
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Baseline N - Collapsible */}
                <details className="group">
                  <summary className="cursor-pointer font-medium text-sm text-[var(--text-muted)] group-open:text-[var(--text)]">
                    Advanced Options
                  </summary>
                  <div className="mt-3 space-y-3 p-3 bg-[var(--bg)] rounded-md border border-[var(--border)]">
                    <div>
                      <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">
                        Baseline Window (candles)
                      </label>
                      <input
                        type="number"
                        value={formData.baseline_n}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            baseline_n: Math.max(1, parseInt(e.target.value) || 1),
                          })
                        }
                        min={1}
                        className="w-full px-3 py-2 border border-[var(--border)] bg-[var(--panel)] text-[var(--text)] rounded-md text-sm"
                      />
                      <p className="text-xs text-[var(--text-faint)] mt-1">
                        Rolling average of last N candles
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">
                        Cooldown (seconds)
                      </label>
                      <select
                        value={formData.cooldown_seconds}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            cooldown_seconds: parseInt(e.target.value),
                          })
                        }
                        className="w-full px-3 py-2 border border-[var(--border)] bg-[var(--panel)] text-[var(--text)] rounded-md text-sm"
                      >
                        <option value={60}>1 minute</option>
                        <option value={300}>5 minutes</option>
                        <option value={600}>10 minutes (default)</option>
                        <option value={1800}>30 minutes</option>
                        <option value={3600}>1 hour</option>
                      </select>
                    </div>
                  </div>
                </details>

                {/* Buttons */}
                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={formLoading}
                    className="flex-1 px-4 py-2 bg-[var(--accent)] text-white rounded-md hover:bg-opacity-90 disabled:opacity-50 transition-colors font-medium"
                  >
                    {formLoading ? "Creating..." : "Create Rule"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="px-4 py-2 bg-[var(--panel)] text-[var(--text-muted)] border border-[var(--border)] rounded-md hover:text-[var(--text)] transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Rules List */}
          {rulesLoading ? (
            <div className="text-center py-8 text-[var(--text-faint)]">
              Loading rules...
            </div>
          ) : rules.length === 0 ? (
            <div className="p-8 bg-[var(--panel)] border border-[var(--border)] rounded-md text-center">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 text-[var(--text-faint)]" />
              <p className="text-[var(--text-muted)]">No rules created yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {rules.map((rule) => (
                <div
                  key={rule.id}
                  className="p-4 bg-[var(--panel)] border border-[var(--border)] rounded-md flex items-start justify-between"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <input
                        type="checkbox"
                        checked={rule.enabled}
                        onChange={() => handleToggleRule(rule)}
                        className="w-4 h-4 rounded cursor-pointer"
                      />
                      <h4 className="font-semibold text-[var(--text)] text-lg">
                        {rule.symbol}
                      </h4>
                      {rule.enabled && (
                        <span className="px-2 py-1 text-xs bg-[var(--accent)] bg-opacity-20 text-[var(--accent)] rounded-full">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-[var(--text-muted)]">
                      Timeframes:{" "}
                      <span className="font-mono text-[var(--accent)]">
                        {rule.timeframes.join(", ")}
                      </span>
                    </p>
                    <p className="text-sm text-[var(--text-muted)]">
                      Thresholds:{" "}
                      <span className="font-mono text-[var(--accent)]">
                        {rule.thresholds.map((t) => `${t}x`).join(", ")}
                      </span>{" "}
                      • Cooldown:{" "}
                      <span className="font-mono text-[var(--accent)]">
                        {Math.floor(rule.cooldown_seconds / 60)}m
                      </span>
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteRule(rule.id)}
                    className="ml-2 p-2 text-[var(--text-faint)] hover:text-[var(--semantic-red)] hover:bg-[var(--semantic-red)] hover:bg-opacity-10 rounded-md transition-colors"
                    title="Delete rule"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Events Tab */}
      {activeTab === "events" && (
        <div className="space-y-4">
          {eventsLoading && events.length === 0 ? (
            <div className="text-center py-8 text-[var(--text-faint)]">
              Loading events...
            </div>
          ) : events.length === 0 ? (
            <div className="p-8 bg-[var(--panel)] border border-[var(--border)] rounded-md text-center">
              <Clock className="w-8 h-8 mx-auto mb-2 text-[var(--text-faint)]" />
              <p className="text-[var(--text-muted)]">
                No alert events yet. Create a rule and wait for spikes!
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="p-4 bg-[var(--panel)] border border-l-4 border-l-[var(--accent)] border-[var(--border)] rounded-md"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {event.type === "SPIKE" ? (
                          <TrendingUp className="w-5 h-5 text-[var(--accent)]" />
                        ) : (
                          <CheckCircle className="w-5 h-5 text-[var(--accent)]" />
                        )}
                        <h4 className="font-semibold text-[var(--text)] text-lg">
                          {event.symbol}
                        </h4>
                        <span className="px-2 py-1 text-xs bg-[var(--accent)] bg-opacity-20 text-[var(--accent)] rounded-full">
                          {event.type === "SPIKE" ? "Spike" : "New Coin"}
                        </span>
                      </div>

                      {event.type === "SPIKE" ? (
                        <div className="text-sm text-[var(--text-muted)] space-y-1">
                          <p>
                            Threshold:{" "}
                            <span className="font-mono text-[var(--accent)]">
                              {event.threshold}×
                            </span>{" "}
                            (actual:{" "}
                            <span className="font-mono">
                              {event.ratio?.toFixed(2)}×
                            </span>
                            )
                          </p>
                          <p>
                            Timeframe:{" "}
                            <span className="font-mono text-[var(--accent)]">
                              {event.timeframe}
                            </span>
                          </p>
                        </div>
                      ) : (
                        <div className="text-sm text-[var(--text-muted)] space-y-1">
                          <p>Detected under filters:</p>
                          {event.monitor_filters && (
                            <div className="font-mono text-xs text-[var(--text-faint)] bg-[var(--bg)] p-2 rounded border border-[var(--border)]">
                              <div>
                                Min MC: $
                                {(
                                  event.monitor_filters.min_market_cap / 1e6
                                ).toFixed(1)}
                                M
                              </div>
                              <div>
                                Max MC: $
                                {(
                                  event.monitor_filters.max_market_cap / 1e9
                                ).toFixed(2)}
                                B
                              </div>
                              <div>
                                Min Vol: $
                                {(
                                  event.monitor_filters.min_volume_24h / 1e6
                                ).toFixed(1)}
                                M
                              </div>
                              <div>
                                Min Vol/MC%:{" "}
                                {event.monitor_filters.min_vol_mcap_pct.toFixed(
                                  2
                                )}
                                %
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      <p className="text-xs text-[var(--text-faint)] mt-2">
                        {new Date(event.triggered_at).toLocaleString()}
                      </p>
                    </div>

                    <div className="text-right text-xs">
                      {event.delivered_channels.includes("inApp") && (
                        <span className="inline-block px-2 py-1 bg-green-900 bg-opacity-30 border border-green-700 rounded text-green-300">
                          📱
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
