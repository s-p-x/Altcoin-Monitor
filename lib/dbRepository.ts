/**
 * Database-backed Alert Repository
 * Replaces in-memory alertStore with Prisma ORM
 */

import { getPrismaClient } from "@/lib/prismaClient";
import { FilterSignatureInput, AlertRule, AlertEvent, MonitorAlertSettings } from "@/lib/types";
import crypto from "crypto";

/**
 * Ensure user exists in database
 */
export async function ensureUser(userId: string) {
  const prisma = getPrismaClient();
  const existing = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!existing) {
    await prisma.user.create({
      data: { id: userId },
    });
  }

  return { id: userId };
}

/**
 * Generate filter signature
 */
export function generateFilterSignature(filters: FilterSignatureInput): string {
  const str = `${filters.min_market_cap}|${filters.max_market_cap}|${filters.min_volume_24h}|${filters.min_vol_mcap_pct}`;
  return crypto.createHash("sha256").update(str).digest("hex");
}

/**
 * Alert Rules
 */
export async function createAlertRule(rule: AlertRule): Promise<AlertRule> {
  await ensureUser(rule.user_id);
  const prisma = getPrismaClient();

  const created = await prisma.alertRule.create({
    data: {
      id: rule.id,
      userId: rule.user_id,
      symbol: rule.symbol,
      timeframesJson: JSON.stringify(rule.timeframes),
      thresholdsJson: JSON.stringify(rule.thresholds),
      baselineN: rule.baseline_n,
      cooldownSeconds: rule.cooldown_seconds,
      enabled: rule.enabled,
    },
  });

  return {
    id: created.id,
    user_id: created.userId,
    symbol: created.symbol,
    timeframes: JSON.parse(created.timeframesJson),
    thresholds: JSON.parse(created.thresholdsJson),
    baseline_n: created.baselineN,
    cooldown_seconds: created.cooldownSeconds,
    enabled: created.enabled,
    created_at: created.createdAt.toISOString(),
    updated_at: created.updatedAt.toISOString(),
  };
}

export async function getAlertRule(id: string): Promise<AlertRule | null> {
  const prisma = getPrismaClient();
  const rule = await prisma.alertRule.findUnique({ where: { id } });
  if (!rule) return null;

  return {
    id: rule.id,
    user_id: rule.userId,
    symbol: rule.symbol,
    timeframes: JSON.parse(rule.timeframesJson),
    thresholds: JSON.parse(rule.thresholdsJson),
    baseline_n: rule.baselineN,
    cooldown_seconds: rule.cooldownSeconds,
    enabled: rule.enabled,
    created_at: rule.createdAt.toISOString(),
    updated_at: rule.updatedAt.toISOString(),
  };
}

export async function getUserAlertRules(userId: string): Promise<AlertRule[]> {
  const prisma = getPrismaClient();
  const rules = await prisma.alertRule.findMany({
    where: { userId },
  });

  return rules.map((rule) => ({
    id: rule.id,
    user_id: rule.userId,
    symbol: rule.symbol,
    timeframes: JSON.parse(rule.timeframesJson),
    thresholds: JSON.parse(rule.thresholdsJson),
    baseline_n: rule.baselineN,
    cooldown_seconds: rule.cooldownSeconds,
    enabled: rule.enabled,
    created_at: rule.createdAt.toISOString(),
    updated_at: rule.updatedAt.toISOString(),
  }));
}

export async function updateAlertRule(rule: AlertRule): Promise<AlertRule> {
  const prisma = getPrismaClient();
  const updated = await prisma.alertRule.update({
    where: { id: rule.id },
    data: {
      enabled: rule.enabled,
      cooldownSeconds: rule.cooldown_seconds,
      timeframesJson: JSON.stringify(rule.timeframes),
      thresholdsJson: JSON.stringify(rule.thresholds),
      baselineN: rule.baseline_n,
    },
  });

  return {
    id: updated.id,
    user_id: updated.userId,
    symbol: updated.symbol,
    timeframes: JSON.parse(updated.timeframesJson),
    thresholds: JSON.parse(updated.thresholdsJson),
    baseline_n: updated.baselineN,
    cooldown_seconds: updated.cooldownSeconds,
    enabled: updated.enabled,
    created_at: updated.createdAt.toISOString(),
    updated_at: updated.updatedAt.toISOString(),
  };
}

export async function deleteAlertRule(id: string): Promise<void> {
  const prisma = getPrismaClient();
  await prisma.alertRule.delete({ where: { id } });
}

/**
 * Alert Events
 */
export async function createAlertEvent(event: AlertEvent): Promise<AlertEvent> {
  await ensureUser(event.user_id);
  const prisma = getPrismaClient();

  const created = await prisma.alertEvent.create({
    data: {
      id: event.id,
      userId: event.user_id,
      ruleId: event.rule_id || null,
      type: event.type,
      symbol: event.symbol,
      timeframe: event.timeframe || null,
      threshold: event.threshold || null,
      ratio: event.ratio || null,
      currentVol: event.current_vol || null,
      baselineVol: event.baseline_vol || null,
      monitorFiltersJson: event.monitor_filters ? JSON.stringify(event.monitor_filters) : null,
      triggeredAt: new Date(event.triggered_at),
      deliveredChannelsJson: JSON.stringify(event.delivered_channels),
      status: event.status,
    },
  });

  return {
    id: created.id,
    rule_id: created.ruleId,
    type: created.type as any,
    symbol: created.symbol,
    timeframe: created.timeframe,
    threshold: created.threshold,
    ratio: created.ratio,
    current_vol: created.currentVol,
    baseline_vol: created.baselineVol,
    monitor_filters: created.monitorFiltersJson ? JSON.parse(created.monitorFiltersJson) : null,
    triggered_at: created.triggeredAt.toISOString(),
    delivered_channels: JSON.parse(created.deliveredChannelsJson),
    status: created.status as any,
    user_id: created.userId,
  };
}

export async function getUserAlertEvents(userId: string, limit: number = 50): Promise<AlertEvent[]> {
  const prisma = getPrismaClient();
  const events = await prisma.alertEvent.findMany({
    where: { userId },
    orderBy: { triggeredAt: "desc" },
    take: limit,
  });

  return events.map((event) => ({
    id: event.id,
    rule_id: event.ruleId,
    type: event.type as any,
    symbol: event.symbol,
    timeframe: event.timeframe,
    threshold: event.threshold,
    ratio: event.ratio,
    current_vol: event.currentVol,
    baseline_vol: event.baselineVol,
    monitor_filters: event.monitorFiltersJson ? JSON.parse(event.monitorFiltersJson) : null,
    triggered_at: event.triggeredAt.toISOString(),
    delivered_channels: JSON.parse(event.deliveredChannelsJson),
    status: event.status as any,
    user_id: event.userId,
  }));
}

/**
 * Monitor Alert Settings
 */
export async function getOrCreateMonitorAlertSettings(
  userId: string,
  filterSignature: string
): Promise<MonitorAlertSettings> {
  await ensureUser(userId);
  const prisma = getPrismaClient();

  let settings = await prisma.monitorAlertSettings.findUnique({
    where: {
      userId_filterSignature: { userId, filterSignature },
    },
  });

  if (!settings) {
    settings = await prisma.monitorAlertSettings.create({
      data: {
        userId,
        filterSignature,
        enabled: true,
        cooldownSeconds: 600,
      },
    });
  }

  return {
    id: settings.id,
    user_id: settings.userId,
    filter_signature: settings.filterSignature,
    enabled: settings.enabled,
    cooldown_seconds: settings.cooldownSeconds,
    last_coin_ids: [],
    created_at: settings.createdAt.toISOString(),
    updated_at: settings.updatedAt.toISOString(),
  };
}

export async function updateMonitorAlertSettings(
  userId: string,
  filterSignature: string,
  updates: Partial<MonitorAlertSettings>
): Promise<MonitorAlertSettings> {
  const prisma = getPrismaClient();
  const settings = await prisma.monitorAlertSettings.upsert({
    where: {
      userId_filterSignature: { userId, filterSignature },
    },
    update: {
      enabled: updates.enabled,
      cooldownSeconds: updates.cooldown_seconds,
    },
    create: {
      userId,
      filterSignature,
      enabled: updates.enabled !== undefined ? updates.enabled : true,
      cooldownSeconds: updates.cooldown_seconds || 600,
    },
  });

  return {
    id: settings.id,
    user_id: settings.userId,
    filter_signature: settings.filterSignature,
    enabled: settings.enabled,
    cooldown_seconds: settings.cooldownSeconds,
    last_coin_ids: [],
    created_at: settings.createdAt.toISOString(),
    updated_at: settings.updatedAt.toISOString(),
  };
}

/**
 * Monitor Alert State (track previous coin set)
 */
export async function getMonitorAlertState(userId: string, filterSignature: string) {
  await ensureUser(userId);
  const prisma = getPrismaClient();

  const state = await prisma.monitorAlertState.findUnique({
    where: {
      userId_filterSignature: { userId, filterSignature },
    },
  });

  return state
    ? {
        id: state.id,
        prevCoinIds: JSON.parse(state.prevCoinIdsJson),
        lastSignatureSeenAt: state.lastSignatureSeenAt?.toISOString() || null,
      }
    : null;
}

export async function upsertMonitorAlertState(
  userId: string,
  filterSignature: string,
  prevCoinIds: string[]
) {
  await ensureUser(userId);
  const prisma = getPrismaClient();

  const state = await prisma.monitorAlertState.upsert({
    where: {
      userId_filterSignature: { userId, filterSignature },
    },
    update: {
      prevCoinIdsJson: JSON.stringify(prevCoinIds),
      lastSignatureSeenAt: new Date(),
    },
    create: {
      userId,
      filterSignature,
      prevCoinIdsJson: JSON.stringify(prevCoinIds),
      lastSignatureSeenAt: new Date(),
    },
  });

  return state;
}

/**
 * Telegram Links
 */
export async function getOrCreateTelegramLink(userId: string) {
  await ensureUser(userId);
  const prisma = getPrismaClient();

  let link = await prisma.telegramLink.findUnique({
    where: { userId },
  });

  if (!link) {
    link = await prisma.telegramLink.create({
      data: { userId },
    });
  }

  return link;
}

export async function updateTelegramChatId(userId: string, chatId: string, enabled: boolean = true) {
  const prisma = getPrismaClient();
  const link = await prisma.telegramLink.update({
    where: { userId },
    data: { chatId, enabled },
  });

  return link;
}

export async function getTelegramLink(userId: string) {
  const prisma = getPrismaClient();
  return prisma.telegramLink.findUnique({
    where: { userId },
  });
}

/**
 * Cooldown tracking (keep simple with DB timestamps)
 */
const cooldownTracking = new Map<string, number>();

export function checkAndUpdateCoinCooldown(
  userId: string,
  symbol: string,
  filterSig: string,
  cooldownSeconds: number
): boolean {
  const key = `${userId}:${symbol}:${filterSig}`;
  const now = Date.now();
  const lastAlerted = cooldownTracking.get(key) || 0;

  if (now - lastAlerted >= cooldownSeconds * 1000) {
    cooldownTracking.set(key, now);
    return true;
  }

  return false;
}

export function checkSpikeRuleCooldown(
  ruleId: string,
  timeframe: string,
  threshold: number,
  cooldownSeconds: number
): boolean {
  const key = `spike:${ruleId}:${timeframe}:${threshold}`;
  const now = Date.now();
  const lastAlerted = cooldownTracking.get(key) || 0;

  if (now - lastAlerted >= cooldownSeconds * 1000) {
    cooldownTracking.set(key, now);
    return true;
  }

  return false;
}
