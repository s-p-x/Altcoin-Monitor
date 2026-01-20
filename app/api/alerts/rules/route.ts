import { NextResponse, NextRequest } from "next/server";
import {
  getUserAlertRules,
  createAlertRule,
  updateAlertRule,
  deleteAlertRule,
} from "@/lib/dbRepository";
import { AlertRule } from "@/lib/types";

/**
 * Get user ID from request (dev auth: x-user-id header or demo_user)
 */
function getUserId(req: NextRequest): string {
  const userId = req.headers.get("x-user-id") || "demo_user";
  return userId;
}

/**
 * GET /api/alerts/rules
 * Get all alert rules for current user
 */
export async function GET(request: NextRequest) {
  try {
    const userId = getUserId(request);
    const rules = await getUserAlertRules(userId);
    return NextResponse.json({ rules });
  } catch (error: any) {
    console.error("[GET /api/alerts/rules] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch rules" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/alerts/rules
 * Create a new alert rule
 */
export async function POST(request: NextRequest) {
  try {
    const userId = getUserId(request);
    const body = await request.json();
    const { symbol, timeframes, thresholds, baseline_n, cooldown_seconds } = body;

    if (!symbol || !timeframes || !thresholds) {
      return NextResponse.json(
        { error: "Missing required fields: symbol, timeframes, thresholds" },
        { status: 400 }
      );
    }

    const rule: AlertRule = {
      id: `ar_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      user_id: userId,
      symbol: symbol.toUpperCase(),
      timeframes,
      thresholds,
      baseline_n: baseline_n || 20,
      cooldown_seconds: cooldown_seconds || 300,
      enabled: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const created = await createAlertRule(rule);
    return NextResponse.json({ rule: created }, { status: 201 });
  } catch (error: any) {
    console.error("[POST /api/alerts/rules] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create rule" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/alerts/rules
 * Update an alert rule
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Rule id required in body" },
        { status: 400 }
      );
    }

    const updated = await updateAlertRule({
      ...updates,
      id,
      updated_at: new Date().toISOString(),
    });

    return NextResponse.json({ rule: updated });
  } catch (error: any) {
    console.error("[PUT /api/alerts/rules] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update rule" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/alerts/rules
 * Delete an alert rule
 */
export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Rule id query parameter required" },
        { status: 400 }
      );
    }

    await deleteAlertRule(id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[DELETE /api/alerts/rules] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete rule" },
      { status: 500 }
    );
  }
}
