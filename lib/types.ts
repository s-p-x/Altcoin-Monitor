/**
 * Type definitions for Alert System
 * Supports both Monitor "new coins" alerts and per-coin volume spike alerts
 */

export type AlertType = "MONITOR_NEW" | "SPIKE";
export type AlertStatus = "triggered" | "delivered" | "dismissed" | "snoozed";

/**
 * Alert Rule: user-defined rule for tracking volume spikes per coin
 */
export interface AlertRule {
  id: string;
  user_id: string;
  symbol: string; // e.g., "BTC", "ETH"
  timeframes: string[]; // e.g., ["1m", "5m", "1h", "4h", "1d"]
  thresholds: number[]; // e.g., [2, 3] for 2x and 3x
  baseline_n: number; // rolling average window, default 20
  cooldown_seconds: number; // default 300 (5 minutes)
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Monitor Alert Settings: per-user, per-filter-signature
 */
export interface MonitorAlertSettings {
  id: string;
  user_id: string;
  filter_signature: string; // stable hash of current filter values
  enabled: boolean;
  cooldown_seconds: number; // default 600 (10 minutes)
  last_coin_ids: string[]; // coin IDs in filtered set at last evaluation
  created_at: string;
  updated_at: string;
}

/**
 * Monitor Alert Filters: the current filter state (part of payload)
 */
export interface MonitorAlertFilters {
  min_market_cap: number;
  max_market_cap: number;
  min_volume_24h: number;
  min_vol_mcap_pct: number;
}

/**
 * Alert Event: record of a fired alert (either Monitor new coin or Spike)
 */
export interface AlertEvent {
  id: string;
  rule_id?: string | null; // null for MONITOR_NEW events
  type: AlertType;
  symbol: string;
  timeframe?: string | null; // null for MONITOR_NEW
  threshold?: number | null; // null for MONITOR_NEW; 2 or 3 for SPIKE
  ratio?: number | null; // current_volume / baseline_volume for SPIKE
  current_vol?: number | null;
  baseline_vol?: number | null;
  monitor_filters?: MonitorAlertFilters | null; // JSON object for MONITOR_NEW
  triggered_at: string;
  delivered_channels: string[]; // ["inApp", "telegram"]
  status: AlertStatus;
  user_id: string;
}

/**
 * Filter Signature input (for hashing)
 */
export interface FilterSignatureInput {
  min_market_cap: number;
  max_market_cap: number;
  min_volume_24h: number;
  min_vol_mcap_pct: number;
}

/**
 * Coin Explainer Types
 */
export interface ExplainMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface MatchedCoin {
  id: string;
  symbol: string;
  name: string;
  market_cap?: number;
  total_volume?: number;
  current_price?: number;
  coingecko_url?: string;
}

export interface ExplainRequest {
  query: string;
  matchedCoin: MatchedCoin | null;
  messages?: ExplainMessage[];
}

export interface ExplainResponse {
  response: string;
}
