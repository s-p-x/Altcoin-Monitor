/**
 * Notification Provider Interface
 * Supports multiple delivery channels (in-app, telegram, email, etc.)
 */

import { AlertEvent, AlertType } from "@/lib/types";

export type NotificationChannel = "inApp" | "telegram" | "email" | "slack";

export interface NotificationPayload {
  type: AlertType;
  symbol: string;
  timeframe?: string | null;
  threshold?: number | null;
  ratio?: number | null;
  current_vol?: number | null;
  baseline_vol?: number | null;
  monitor_filters?: {
    min_market_cap: number;
    max_market_cap: number;
    min_volume_24h: number;
    min_vol_mcap_pct: number;
  } | null;
  triggeredAt: string;
  ruleId?: string | null;
}

export interface INotificationProvider {
  /**
   * Send notification via specified channel
   */
  send(
    userId: string,
    channel: NotificationChannel,
    payload: NotificationPayload
  ): Promise<boolean>;

  /**
   * Get delivery status for a notification
   */
  getStatus(userId: string, channel: NotificationChannel): Promise<boolean>;
}

/**
 * In-App Notification Store (in-memory, client-side)
 */
export class InAppNotificationProvider implements INotificationProvider {
  private notifications: Map<
    string,
    { message: string; timestamp: number; read: boolean }[]
  > = new Map();

  async send(
    userId: string,
    channel: NotificationChannel,
    payload: NotificationPayload
  ): Promise<boolean> {
    if (channel !== "inApp") return false;

    const message = this.formatMessage(payload);
    const userNotifs = this.notifications.get(userId) || [];
    userNotifs.push({
      message,
      timestamp: Date.now(),
      read: false,
    });
    this.notifications.set(userId, userNotifs.slice(-50)); // keep last 50
    return true;
  }

  async getStatus(userId: string, channel: NotificationChannel): Promise<boolean> {
    return channel === "inApp";
  }

  private formatMessage(payload: NotificationPayload): string {
    if (payload.type === "MONITOR_NEW") {
      const filters = payload.monitor_filters;
      return `🆕 New coin detected: ${payload.symbol} (Min MC: $${(filters?.min_market_cap || 0).toLocaleString()}, Max MC: $${(filters?.max_market_cap || 0).toLocaleString()})`;
    } else if (payload.type === "SPIKE") {
      return `⚡ ${payload.symbol} spiked ${payload.threshold}x on ${payload.timeframe} (${payload.ratio?.toFixed(2)}x actual)`;
    }
    return "Alert triggered";
  }

  getUserNotifications(userId: string) {
    return this.notifications.get(userId) || [];
  }
}

/**
 * Telegram Notification Provider
 * Sends alerts via Telegram Bot API
 */
export class TelegramNotificationProvider implements INotificationProvider {
  async send(
    userId: string,
    channel: NotificationChannel,
    payload: NotificationPayload
  ): Promise<boolean> {
    if (channel !== "telegram") return false;

    try {
      // Import here to avoid circular dependencies
      const { getTelegramLink } = await import("@/lib/dbRepository");

      // Get user's telegram chat ID
      const link = await getTelegramLink(userId);

      if (!link?.chatId || !link.enabled) {
        console.log(`Telegram not linked for user ${userId}`);
        return false;
      }

      // Format message
      const message = this.formatTelegramMessage(payload);

      // Send to Telegram
      return await this.sendTelegramMessage(link.chatId, message);
    } catch (error) {
      console.error(`Failed to send Telegram notification for user ${userId}:`, error);
      return false;
    }
  }

  async getStatus(userId: string, channel: NotificationChannel): Promise<boolean> {
    if (channel !== "telegram") return false;

    try {
      const { getTelegramLink } = await import("@/lib/dbRepository");
      const link = await getTelegramLink(userId);
      return !!(link?.chatId && link.enabled);
    } catch (error) {
      console.error(`Failed to get Telegram status for user ${userId}:`, error);
      return false;
    }
  }

  private formatTelegramMessage(payload: NotificationPayload): string {
    if (payload.type === "MONITOR_NEW") {
      const filters = payload.monitor_filters;
      return (
        `🆕 *New Coin Alert*\n\n` +
        `Symbol: *${payload.symbol}*\n` +
        `Market Cap Range: $${((filters?.min_market_cap || 0) / 1e6).toFixed(1)}M - $${((filters?.max_market_cap || 0) / 1e9).toFixed(2)}B\n` +
        `Min 24h Volume: $${((filters?.min_volume_24h || 0) / 1e6).toFixed(1)}M\n` +
        `Time: ${new Date(payload.triggeredAt).toLocaleString()}`
      );
    } else if (payload.type === "SPIKE") {
      return (
        `⚡ *Volume Spike Alert*\n\n` +
        `Symbol: *${payload.symbol}*\n` +
        `Timeframe: ${payload.timeframe}\n` +
        `Threshold: ${payload.threshold}x\n` +
        `Actual Ratio: ${payload.ratio?.toFixed(2)}x\n` +
        `Current Vol: $${(payload.current_vol || 0).toLocaleString()}\n` +
        `Baseline Vol: $${(payload.baseline_vol || 0).toLocaleString()}\n` +
        `Time: ${new Date(payload.triggeredAt).toLocaleString()}`
      );
    }
    return `🔔 *Alert Triggered*\n\nTime: ${new Date(payload.triggeredAt).toLocaleString()}`;
  }

  private async sendTelegramMessage(chatId: string, text: string): Promise<boolean> {
    try {
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      if (!botToken) {
        console.warn("TELEGRAM_BOT_TOKEN not configured");
        return false;
      }

      const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "Markdown",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error(`Telegram API error: ${response.status}`, errorData);
        return false;
      }

      return true;
    } catch (error) {
      console.error("Failed to send Telegram message:", error);
      return false;
    }
  }
}

/**
 * Composite provider that can send to multiple channels
 */
export class CompositeNotificationProvider implements INotificationProvider {
  private providers: Map<NotificationChannel, INotificationProvider> = new Map();

  constructor() {
    this.providers.set("inApp", new InAppNotificationProvider());
    this.providers.set("telegram", new TelegramNotificationProvider());
  }

  async send(
    userId: string,
    channel: NotificationChannel,
    payload: NotificationPayload
  ): Promise<boolean> {
    const provider = this.providers.get(channel);
    if (!provider) return false;
    return provider.send(userId, channel, payload);
  }

  async getStatus(
    userId: string,
    channel: NotificationChannel
  ): Promise<boolean> {
    const provider = this.providers.get(channel);
    if (!provider) return false;
    return provider.getStatus(userId, channel);
  }

  getInAppProvider(): InAppNotificationProvider {
    return this.providers.get("inApp") as InAppNotificationProvider;
  }
}

// Singleton
export const notificationProvider = new CompositeNotificationProvider();
