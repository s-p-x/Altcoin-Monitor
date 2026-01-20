/**
 * Alert Evaluator Logic
 * Runs periodically to:
 * 1. Detect new coins in Monitor filtered list
 * 2. Evaluate volume spike rules
 * 3. Enforce cooldowns and deduplication
 */

import {
  AlertRule,
  AlertEvent,
  MonitorAlertSettings,
  FilterSignatureInput,
  MonitorAlertFilters,
} from "@/lib/types";
import {
  createAlertEvent,
  generateFilterSignature,
  getOrCreateMonitorAlertSettings,
  updateMonitorAlertSettings,
  checkAndUpdateCoinCooldown,
  checkSpikeRuleCooldown,
  getUserAlertRules,
  getMonitorAlertState,
  upsertMonitorAlertState,
} from "@/lib/dbRepository";
import { notificationProvider, NotificationPayload } from "@/lib/notificationProvider";
import { fetchCandles, calculateVolumeSpike } from "@/lib/exchangeAdapter";

/**
 * Unique ID generator
 */
function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Monitor Alert Evaluator
 * Detects new coins appearing in the filtered list
 *
 * @param userId
 * @param currentFilteredCoinIds Coin IDs currently visible after filters
 * @param filterValues Current filter values
 * @returns Number of alerts fired
 */
export async function evaluateMonitorAlerts(
  userId: string,
  currentFilteredCoinIds: string[],
  filterValues: FilterSignatureInput,
  coinData: Map<string, { symbol: string; name: string }>
): Promise<number> {
  const filterSig = generateFilterSignature(filterValues);
  const settings = await getOrCreateMonitorAlertSettings(userId, filterSig);

  // If disabled, skip
  if (!settings.enabled) {
    return 0;
  }

  // Get previous state
  const prevState = await getMonitorAlertState(userId, filterSig);
  const previousCoinIds = new Set(prevState?.prevCoinIds || []);
  const currentCoinIds = new Set(currentFilteredCoinIds);

  // Find new coins (not in previous set)
  const newCoinIds: string[] = [];
  for (const id of currentCoinIds) {
    if (!previousCoinIds.has(id)) {
      newCoinIds.push(id);
    }
  }

  // Update the stored state for next evaluation
  await upsertMonitorAlertState(userId, filterSig, currentFilteredCoinIds);

  // Fire alerts for new coins (respecting cooldown)
  let alertsCount = 0;
  for (const coinId of newCoinIds) {
    const coinInfo = coinData.get(coinId);
    if (!coinInfo) continue;

    // Check cooldown per coin per filter signature
    if (
      checkAndUpdateCoinCooldown(
        userId,
        coinInfo.symbol,
        filterSig,
        settings.cooldown_seconds
      )
    ) {
      const event: AlertEvent = {
        id: generateId("ae"),
        rule_id: null,
        type: "MONITOR_NEW",
        symbol: coinInfo.symbol,
        timeframe: null,
        threshold: null,
        ratio: null,
        current_vol: null,
        baseline_vol: null,
        monitor_filters: {
          min_market_cap: filterValues.min_market_cap,
          max_market_cap: filterValues.max_market_cap,
          min_volume_24h: filterValues.min_volume_24h,
          min_vol_mcap_pct: filterValues.min_vol_mcap_pct,
        },
        triggered_at: new Date().toISOString(),
        delivered_channels: [],
        status: "triggered",
        user_id: userId,
      };

      // Create alert event
      await createAlertEvent(event);

      // Send in-app notification
      const notifPayload: NotificationPayload = {
        type: "MONITOR_NEW",
        symbol: coinInfo.symbol,
        monitor_filters: event.monitor_filters,
        triggeredAt: event.triggered_at,
      };

      try {
        const sent = await notificationProvider.send(
          userId,
          "inApp",
          notifPayload
        );
        if (sent) {
          event.delivered_channels.push("inApp");
        }
      } catch (err) {
        console.error(
          `Failed to send in-app notification for ${coinInfo.symbol}:`,
          err
        );
      }

      alertsCount++;
    }
  }

  return alertsCount;
}

/**
 * Get baseline volume for a coin over N recent candles
 * Fetches from Binance API
 *
 * @param symbol Coin symbol
 * @param timeframe Chart timeframe (1m, 5m, 1h, etc.)
 * @param baselineN Number of candles to average
 * @returns Average volume
 */
async function getBaselineVolume(
  symbol: string,
  timeframe: string,
  baselineN: number
): Promise<number> {
  try {
    const candles = await fetchCandles(symbol, timeframe, baselineN + 1);
    if (candles.length === 0) {
      console.warn(`No candles found for ${symbol} on ${timeframe}`);
      return 0;
    }

    // Average volume of baseline candles (excluding current)
    const baseline = candles.slice(0, baselineN);
    const avgVolume = baseline.reduce((sum, c) => sum + c.volume, 0) / baseline.length;
    return avgVolume;
  } catch (err) {
    console.error(
      `Failed to get baseline volume for ${symbol} on ${timeframe}:`,
      err
    );
    return 0;
  }
}

/**
 * Get current volume for a coin on a specific timeframe
 * Fetches from Binance API
 */
async function getCurrentVolume(
  symbol: string,
  timeframe: string
): Promise<number> {
  try {
    const candles = await fetchCandles(symbol, timeframe, 1);
    if (candles.length === 0) {
      console.warn(`No candles found for ${symbol} on ${timeframe}`);
      return 0;
    }

    return candles[0].volume;
  } catch (err) {
    console.error(
      `Failed to get current volume for ${symbol} on ${timeframe}:`,
      err
    );
    return 0;
  }
}

/**
 * Evaluate spike alerts for a user's rules
 *
 * @param userId
 * @returns Number of alerts fired
 */
export async function evaluateSpikeAlerts(userId: string): Promise<number> {
  const rules = await getUserAlertRules(userId);
  let alertsCount = 0;

  for (const rule of rules) {
    if (!rule.enabled) continue;

    for (const timeframe of rule.timeframes) {
      try {
        const baselineVol = await getBaselineVolume(
          rule.symbol,
          timeframe,
          rule.baseline_n
        );
        const currentVol = await getCurrentVolume(rule.symbol, timeframe);

        if (baselineVol <= 0) continue;

        const ratio = currentVol / baselineVol;

        // Evaluate thresholds in descending order (3x before 2x)
        // If 3x triggered, don't fire 2x for same evaluation
        for (const threshold of rule.thresholds.sort((a, b) => b - a)) {
          if (ratio >= threshold) {
            // Check cooldown for this specific rule+timeframe+threshold
            if (
              checkSpikeRuleCooldown(
                rule.id,
                timeframe,
                threshold,
                rule.cooldown_seconds
              )
            ) {
              const event: AlertEvent = {
                id: generateId("ae"),
                rule_id: rule.id,
                type: "SPIKE",
                symbol: rule.symbol,
                timeframe,
                threshold,
                ratio,
                current_vol: currentVol,
                baseline_vol: baselineVol,
                monitor_filters: null,
                triggered_at: new Date().toISOString(),
                delivered_channels: [],
                status: "triggered",
                user_id: userId,
              };

              // Create alert event
              await createAlertEvent(event);

              // Send in-app notification
              const notifPayload: NotificationPayload = {
                type: "SPIKE",
                symbol: rule.symbol,
                timeframe,
                threshold,
                ratio,
                current_vol: currentVol,
                baseline_vol: baselineVol,
                triggeredAt: event.triggered_at,
                ruleId: rule.id,
              };

              try {
                const sent = await notificationProvider.send(
                  userId,
                  "inApp",
                  notifPayload
                );
                if (sent) {
                  event.delivered_channels.push("inApp");
                }
              } catch (err) {
                console.error(
                  `Failed to send spike notification for ${rule.symbol}:`,
                  err
                );
              }

              alertsCount++;
              break; // Don't fire lower thresholds if higher one triggered
            }
          }
        }
      } catch (err) {
        console.error(
          `Error evaluating spike rule ${rule.id} for timeframe ${timeframe}:`,
          err
        );
      }
    }
  }

  return alertsCount;
}
