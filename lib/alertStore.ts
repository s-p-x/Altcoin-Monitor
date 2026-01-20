/**
 * In-memory data store for alerts (development/demo mode)
 * In production, replace with proper database (Prisma, Supabase, etc.)
 */

import {
  AlertRule,
  AlertEvent,
  MonitorAlertSettings,
  FilterSignatureInput,
} from "@/lib/types";
import crypto from "crypto";

// In-memory stores
const alertRules = new Map<string, AlertRule>();
const alertEvents = new Map<string, AlertEvent>();
const monitorAlertSettings = new Map<string, MonitorAlertSettings>();
const userCoinCooldowns = new Map<string, number>(); // key: "${userId}:${symbol}:${filterSig}", value: lastAlertedAt

/**
 * Generate a stable hash of filter values
 */
export function generateFilterSignature(
  filters: FilterSignatureInput
): string {
  const str = `${filters.min_market_cap}|${filters.max_market_cap}|${filters.min_volume_24h}|${filters.min_vol_mcap_pct}`;
  return crypto.createHash("sha256").update(str).digest("hex");
}

/**
 * Alert Rules
 */
export async function createAlertRule(rule: AlertRule): Promise<AlertRule> {
  alertRules.set(rule.id, rule);
  return rule;
}

export async function getAlertRule(id: string): Promise<AlertRule | null> {
  return alertRules.get(id) || null;
}

export async function getUserAlertRules(userId: string): Promise<AlertRule[]> {
  return Array.from(alertRules.values()).filter((r) => r.user_id === userId);
}

export async function updateAlertRule(rule: AlertRule): Promise<AlertRule> {
  alertRules.set(rule.id, { ...rule, updated_at: new Date().toISOString() });
  return alertRules.get(rule.id)!;
}

export async function deleteAlertRule(id: string): Promise<void> {
  alertRules.delete(id);
}

/**
 * Alert Events
 */
export async function createAlertEvent(event: AlertEvent): Promise<AlertEvent> {
  alertEvents.set(event.id, event);
  return event;
}

export async function getUserAlertEvents(
  userId: string,
  limit: number = 50
): Promise<AlertEvent[]> {
  const events = Array.from(alertEvents.values())
    .filter((e) => e.user_id === userId)
    .sort(
      (a, b) =>
        new Date(b.triggered_at).getTime() - new Date(a.triggered_at).getTime()
    )
    .slice(0, limit);
  return events;
}

/**
 * Monitor Alert Settings
 */
export async function getOrCreateMonitorAlertSettings(
  userId: string,
  filterSignature: string
): Promise<MonitorAlertSettings> {
  const key = `${userId}:${filterSignature}`;
  let settings = monitorAlertSettings.get(key);

  if (!settings) {
    settings = {
      id: `mas_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      user_id: userId,
      filter_signature: filterSignature,
      enabled: true,
      cooldown_seconds: 600, // 10 minutes default
      last_coin_ids: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    monitorAlertSettings.set(key, settings);
  }

  return settings;
}

export async function updateMonitorAlertSettings(
  userId: string,
  filterSignature: string,
  updates: Partial<MonitorAlertSettings>
): Promise<MonitorAlertSettings> {
  const key = `${userId}:${filterSignature}`;
  const settings = await getOrCreateMonitorAlertSettings(userId, filterSignature);
  const updated = {
    ...settings,
    ...updates,
    updated_at: new Date().toISOString(),
  };
  monitorAlertSettings.set(key, updated);
  return updated;
}

/**
 * Cooldown tracking for new coin alerts
 */
export function checkAndUpdateCoinCooldown(
  userId: string,
  symbol: string,
  filterSignature: string,
  cooldownSeconds: number
): boolean {
  const key = `${userId}:${symbol}:${filterSignature}`;
  const now = Date.now();
  const lastAlerted = userCoinCooldowns.get(key) || 0;

  if (now - lastAlerted >= cooldownSeconds * 1000) {
    userCoinCooldowns.set(key, now);
    return true; // passed cooldown, fire alert
  }

  return false; // still in cooldown
}

/**
 * Spike detection cooldown per rule+timeframe+threshold
 */
export function checkSpikeRuleCooldown(
  ruleId: string,
  timeframe: string,
  threshold: number,
  cooldownSeconds: number
): boolean {
  const key = `spike:${ruleId}:${timeframe}:${threshold}`;
  const now = Date.now();
  const lastAlerted = userCoinCooldowns.get(key) || 0;

  if (now - lastAlerted >= cooldownSeconds * 1000) {
    userCoinCooldowns.set(key, now);
    return true;
  }

  return false;
}
