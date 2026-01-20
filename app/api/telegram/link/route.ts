/**
 * Telegram Account Linking Endpoint
 * Links a Telegram chat ID to the user account
 */

import { NextRequest, NextResponse } from "next/server";
import { updateTelegramChatId } from "@/lib/dbRepository";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { chatId } = body;
    const userId = req.headers.get("x-user-id") || "demo_user";

    if (!chatId) {
      return NextResponse.json(
        { error: "chatId is required" },
        { status: 400 }
      );
    }

    // Link the chat ID to the user
    const result = await updateTelegramChatId(userId, chatId.toString(), true);

    return NextResponse.json(
      {
        success: true,
        message: "Telegram account linked successfully",
        telegramLink: {
          userId: result.userId,
          chatId: result.chatId,
          enabled: result.enabled,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Failed to link Telegram:", error);
    return NextResponse.json(
      { error: "Failed to link Telegram account" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const userId = req.headers.get("x-user-id") || "demo_user";

    // Get linking status
    // Import getTelegramLink after setting up the import
    const { getTelegramLink } = await import("@/lib/dbRepository");
    const link = await getTelegramLink(userId);

    return NextResponse.json(
      {
        linked: !!link?.chatId,
        chatId: link?.chatId || null,
        enabled: link?.enabled || false,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Failed to get Telegram status:", error);
    return NextResponse.json(
      { error: "Failed to get Telegram status" },
      { status: 500 }
    );
  }
}
