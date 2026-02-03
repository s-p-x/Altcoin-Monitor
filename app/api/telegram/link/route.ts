/**
 * Telegram Account Linking Endpoint
 * Generates a link code for secure Telegram pairing
 */

import { NextRequest, NextResponse } from "next/server";
import { generateTelegramLinkCode, getTelegramLink } from "@/lib/dbRepository";

/**
 * POST /api/telegram/link
 * Generate a new link code for the authenticated user
 */
export async function POST(req: NextRequest) {
  try {
    const userId = req.headers.get("x-user-id") || "demo_user";

    // Generate a 6-digit code that expires in 10 minutes
    const code = Math.random().toString().substring(2, 8).padStart(6, '0');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const link = await generateTelegramLinkCode(userId, code, expiresAt);

    return NextResponse.json(
      {
        success: true,
        code,
        expiresAt: expiresAt.toISOString(),
        expiresInSeconds: 600,
        instructions: "Send '/link " + code + "' to the bot in Telegram",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Failed to generate link code:", error);
    return NextResponse.json(
      { error: "Failed to generate link code" },
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
