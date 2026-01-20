/**
 * Telegram Bot Webhook
 * Receives updates from Telegram Bot API
 * This endpoint is only functional if TELEGRAM_BOT_TOKEN is configured
 */

import { NextRequest, NextResponse } from "next/server";
import { updateTelegramChatId } from "@/lib/dbRepository";

// Read token at request time, not at module load time
function getTelegramBotToken(): string {
  return process.env.TELEGRAM_BOT_TOKEN || "";
}

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: {
      id: number;
      first_name: string;
    };
    chat: {
      id: number;
    };
    text: string;
  };
}

export async function POST(req: NextRequest) {
  const TELEGRAM_BOT_TOKEN = getTelegramBotToken();

  // If Telegram is not configured, return 403
  if (!TELEGRAM_BOT_TOKEN) {
    return NextResponse.json(
      { error: "Telegram bot not configured" },
      { status: 403 }
    );
  }

  try {
    // Verify the webhook token
    const url = new URL(req.url);
    const pathToken = url.pathname.split("/").pop();

    if (pathToken !== TELEGRAM_BOT_TOKEN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body: TelegramUpdate = await req.json();

    // Only handle messages for now
    if (!body.message) {
      return NextResponse.json({ ok: true });
    }

    const message = body.message;
    const chatId = message.chat.id.toString();
    const text = message.text || "";

    // Handle /start command - pair telegram with user account
    if (text === "/start") {
      const startResponse = await sendTelegramMessage(
        chatId,
        "👋 Welcome to AltcoinMonitor Alerts!\n\n" +
          "To link your Telegram account:\n" +
          "1. Go to http://localhost:3000 (or your app URL)\n" +
          "2. Click Settings / Telegram\n" +
          "3. Enter this chat ID: `" +
          chatId +
          "`\n\n" +
          "You'll then receive alerts via Telegram!"
      );

      if (startResponse) {
        // Auto-save this chat ID with a placeholder user
        // (In real app, would require manual linking)
        console.log(`Telegram chat ${chatId} ready for linking`);
      }
    }

    // Handle /help command
    if (text === "/help") {
      await sendTelegramMessage(
        chatId,
        "/start - Get started with AltcoinMonitor\n" +
          "/help - Show this help message\n" +
          "/status - Check connection status"
      );
    }

    // Handle /status command
    if (text === "/status") {
      await sendTelegramMessage(
        chatId,
        "✅ Bot is connected and listening for alerts!"
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Telegram webhook error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Send message to Telegram
 * Returns false silently if bot token is not configured
 */
export async function sendTelegramMessage(
  chatId: string,
  text: string
): Promise<boolean> {
  const TELEGRAM_BOT_TOKEN = getTelegramBotToken();

  // If Telegram is not configured, fail silently
  if (!TELEGRAM_BOT_TOKEN) {
    return false;
  }

  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

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
      console.error(`Telegram API error: ${response.status}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Failed to send Telegram message:", error);
    return false;
  }
}

/**
 * Set up webhook with Telegram
 * Call this once during deployment or setup (if token is configured)
 */
export async function setupWebhook(baseUrl: string): Promise<boolean> {
  const TELEGRAM_BOT_TOKEN = getTelegramBotToken();

  if (!TELEGRAM_BOT_TOKEN) {
    console.warn("Telegram bot token not configured, skipping webhook setup");
    return false;
  }

  try {
    const webhookUrl = `${baseUrl}/api/telegram/webhook/${TELEGRAM_BOT_TOKEN}`;
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ["message"],
      }),
    });

    const data = await response.json();
    console.log("Telegram webhook setup response:", data);

    return data.ok;
  } catch (error) {
    console.error("Failed to setup Telegram webhook:", error);
    return false;
  }
}
