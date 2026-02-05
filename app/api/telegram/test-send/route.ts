/**
 * Telegram Test Send Endpoint
 * Tests Telegram pairing by sending a test message
 */

import { NextRequest, NextResponse } from "next/server";
import { getTelegramLink } from "@/lib/dbRepository";

function getTelegramBotToken(): string {
  return process.env.TELEGRAM_BOT_TOKEN || "";
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

/**
 * POST /api/telegram/test-send
 * Send a test message to the authenticated user's linked Telegram
 */
export async function POST(req: NextRequest) {
  try {
    const userId = req.headers.get("x-user-id") || "demo_user";

    // Look up user's Telegram connection
    const telegramLink = await getTelegramLink(userId);

    if (!telegramLink || !telegramLink.chatId) {
      return NextResponse.json(
        {
          success: false,
          error: "Telegram not linked. Generate a code and send /link to the bot first.",
        },
        { status: 400 }
      );
    }

    // Send test message
    const success = await sendTelegramMessage(
      telegramLink.chatId,
      "✅ Test alert — Telegram pairing works."
    );

    if (success) {
      return NextResponse.json(
        {
          success: true,
          message: "Test message sent successfully",
          chatId: telegramLink.chatId,
        },
        { status: 200 }
      );
    } else {
      return NextResponse.json(
        {
          success: false,
          error: "Failed to send message. Check TELEGRAM_BOT_TOKEN configuration.",
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Test send failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal error while sending test message",
      },
      { status: 500 }
    );
  }
}
