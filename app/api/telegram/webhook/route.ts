/**
 * Telegram Bot Webhook
 * Receives updates from Telegram Bot API
 * Handles /start and /link commands for secure pairing
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyAndLinkTelegramCode } from "@/lib/dbRepository";

// Read token at request time, not at module load time
function getTelegramBotToken(): string {
  return process.env.TELEGRAM_BOT_TOKEN || "";
}

function getTelegramWebhookSecret(): string {
  return process.env.TELEGRAM_WEBHOOK_SECRET || "";
}

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: {
      id: number;
      first_name: string;
      username?: string;
    };
    chat: {
      id: number;
    };
    text: string;
  };
}

/**
 * Send a message to a Telegram chat
 */
async function sendTelegramMessage(
  chatId: string,
  text: string,
  parseMode: string = "Markdown"
): Promise<boolean> {
  const TELEGRAM_BOT_TOKEN = getTelegramBotToken();

  if (!TELEGRAM_BOT_TOKEN) {
    console.warn("TELEGRAM_BOT_TOKEN not configured");
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
        parse_mode: parseMode,
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

export async function POST(req: NextRequest) {
  const TELEGRAM_BOT_TOKEN = getTelegramBotToken();
  const TELEGRAM_WEBHOOK_SECRET = getTelegramWebhookSecret();

  // If Telegram is not configured, return 403
  if (!TELEGRAM_BOT_TOKEN) {
    return NextResponse.json(
      { error: "Telegram bot not configured" },
      { status: 403 }
    );
  }

  try {
    // Security: Verify webhook secret
    // Method 1: Check X-Telegram-Bot-Api-Secret-Token header (recommended by Telegram)
    const secretToken = req.headers.get("x-telegram-bot-api-secret-token");
    
    if (TELEGRAM_WEBHOOK_SECRET) {
      if (secretToken !== TELEGRAM_WEBHOOK_SECRET) {
        console.error("[Telegram Webhook] Invalid secret token");
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }
    } else {
      console.warn("[Telegram Webhook] No TELEGRAM_WEBHOOK_SECRET set - webhook is insecure");
    }

    const body: TelegramUpdate = await req.json();

    // Only handle messages for now
    if (!body.message) {
      return NextResponse.json({ ok: true });
    }

    const message = body.message;
    const chatId = message.chat.id.toString();
    const text = message.text || "";
    const firstName = message.from.first_name || "there";

    console.log(`[Telegram Webhook] Message from ${chatId}: ${text}`);

    // Handle /start command
    if (text.trim() === "/start") {
      await sendTelegramMessage(
        chatId,
        `👋 Welcome ${firstName}!\n\n` +
          "Connected. If your app gave you a code, send:\n" +
          "`/link CODE`\n\n" +
          "Example: `/link 123456`"
      );
      return NextResponse.json({ ok: true });
    }

    // Handle /link CODE command
    if (text.trim().startsWith("/link ")) {
      const code = text.trim().substring(6).trim();

      if (!code || code.length !== 6) {
        await sendTelegramMessage(
          chatId,
          "❌ Invalid code format. Please use a 6-digit code:\n`/link 123456`"
        );
        return NextResponse.json({ ok: true });
      }

      // Verify code and link account
      const result = await verifyAndLinkTelegramCode(code, chatId);

      if (result.success) {
        await sendTelegramMessage(
          chatId,
          "✅ *Account linked successfully!*\n\n" +
            "You'll now receive alert notifications here.\n\n" +
            "Commands:\n" +
            "/status - Check connection\n" +
            "/help - Show all commands"
        );
      } else {
        await sendTelegramMessage(
          chatId,
          `❌ *Linking failed*\n\n${result.error}\n\n` +
            "Please generate a new code in the app and try again."
        );
      }

      return NextResponse.json({ ok: true });
    }

    // Handle /status command
    if (text.trim() === "/status") {
      await sendTelegramMessage(
        chatId,
        "✅ *Bot is active*\n\n" +
          "Connection status: Online\n" +
          "Ready to receive alerts!"
      );
      return NextResponse.json({ ok: true });
    }

    // Handle /help command
    if (text.trim() === "/help") {
      await sendTelegramMessage(
        chatId,
        "*Available Commands:*\n\n" +
          "/start - Get started\n" +
          "/link CODE - Link your account (6-digit code from app)\n" +
          "/status - Check connection status\n" +
          "/help - Show this help message"
      );
      return NextResponse.json({ ok: true });
    }

    // Unknown command
    await sendTelegramMessage(
      chatId,
      "Unknown command. Send /help to see available commands."
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Telegram Webhook] Error processing update:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/telegram/webhook
 * Health check endpoint
 */
export async function GET(req: NextRequest) {
  const TELEGRAM_BOT_TOKEN = getTelegramBotToken();
  const TELEGRAM_WEBHOOK_SECRET = getTelegramWebhookSecret();

  return NextResponse.json({
    configured: !!TELEGRAM_BOT_TOKEN,
    secured: !!TELEGRAM_WEBHOOK_SECRET,
    message: "Telegram webhook endpoint is active",
  });
}

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
