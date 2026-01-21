/**
 * Universe API - Returns merged, deduplicated coin universe
 * GET /api/coins/universe
 * 
 * Query params:
 * - userId: user ID (required, passed as header x-user-id in dev mode)
 * 
 * Response: { coins: Coin[] }
 */

import { NextRequest, NextResponse } from "next/server";
import { getUniverseCoins, getUniverseStats } from "@/lib/universeService";

export async function GET(req: NextRequest) {
  try {
    // Get user ID from header (dev mode) or query param
    const userId =
      req.headers.get("x-user-id") || req.nextUrl.searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "userId or x-user-id header required" },
        { status: 400 }
      );
    }

    // Check if dev mode (for stats)
    const isDev = process.env.NODE_ENV === "development";
    const includeStats = req.nextUrl.searchParams.get("stats") === "true";

    // Get universe coins
    const coins = await getUniverseCoins(userId);

    // Optional: include stats in dev mode
    let stats = null;
    if ((isDev || includeStats) && process.env.NODE_ENV === "development") {
      stats = await getUniverseStats(userId);
    }

    return NextResponse.json({
      coins,
      stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error in universe API:", error);
    return NextResponse.json(
      { error: "Failed to fetch universe" },
      { status: 500 }
    );
  }
}
