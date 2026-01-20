import { NextResponse, NextRequest } from "next/server";
import {
  getOrCreateMonitorAlertSettings,
  updateMonitorAlertSettings,
  generateFilterSignature,
} from "@/lib/dbRepository";
import { FilterSignatureInput } from "@/lib/types";

/**
 * Get user ID from request (dev auth)
 */
function getUserId(req: NextRequest): string {
  return req.headers.get("x-user-id") || "demo_user";
}

/**
 * GET /api/alerts/monitor
 * Get monitor alert settings for user + filter
 */
export async function GET(request: NextRequest) {
  try {
    const userId = getUserId(request);

    const filters: FilterSignatureInput = {
      min_market_cap: parseInt(
        request.nextUrl.searchParams.get("minMarketCap") || "0",
        10
      ),
      max_market_cap: parseInt(
        request.nextUrl.searchParams.get("maxMarketCap") || "999999999999",
        10
      ),
      min_volume_24h: parseInt(request.nextUrl.searchParams.get("minVolume") || "0", 10),
      min_vol_mcap_pct: parseFloat(
        request.nextUrl.searchParams.get("minVolMcapPct") || "0"
      ),
    };

    const filterSig = generateFilterSignature(filters);
    const settings = await getOrCreateMonitorAlertSettings(userId, filterSig);

    return NextResponse.json({
      settings,
      filterSignature: filterSig,
      filters,
    });
  } catch (error: any) {
    console.error("[GET /api/alerts/monitor] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch monitor settings" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/alerts/monitor
 * Update monitor alert settings
 */
export async function PUT(request: NextRequest) {
  try {
    const userId = getUserId(request);
    const body = await request.json();
    const { filters, enabled, cooldown_seconds } = body;

    if (!filters) {
      return NextResponse.json(
        { error: "Missing required fields: filters" },
        { status: 400 }
      );
    }

    const filterSig = generateFilterSignature(filters);

    const updated = await updateMonitorAlertSettings(userId, filterSig, {
      enabled: enabled !== undefined ? enabled : true,
      cooldown_seconds: cooldown_seconds || 600,
    } as any);

    return NextResponse.json({ settings: updated });
  } catch (error: any) {
    console.error("[PUT /api/alerts/monitor] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update monitor settings" },
      { status: 500 }
    );
  }
}
