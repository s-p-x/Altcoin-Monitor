/**
 * Alert Evaluation Endpoint
 * Automatically triggered by Vercel Cron to evaluate all alert rules
 * 
 * Schedule:
 * - Spike alerts: Every 10 seconds (via client-side polling or separate cron)
 * - Monitor alerts: Every 60 seconds
 * 
 * Protected by ALERT_EVAL_SECRET header
 */

import { NextResponse, NextRequest } from "next/server";
import { getPrismaClient } from "@/lib/prismaClient";
import {
  evaluateSpikeAlerts,
  evaluateMonitorAlerts,
} from "@/lib/alertEvaluator";

/**
 * Verify request is from Vercel Cron or authorized caller
 */
function isAuthorized(req: NextRequest): boolean {
  const authHeader = req.headers.get("authorization");
  const secret = process.env.ALERT_EVAL_SECRET;

  // If no secret is set, allow (dev mode)
  if (!secret) {
    console.warn(
      "[ALERT_EVAL] No ALERT_EVAL_SECRET set - running in dev mode"
    );
    return true;
  }

  // Check Bearer token
  if (authHeader === `Bearer ${secret}`) {
    return true;
  }

  return false;
}

/**
 * Get all users with active alert rules or monitor settings
 */
async function getUsersToEvaluate(): Promise<string[]> {
  const prisma = getPrismaClient();

  // Get users with enabled spike alert rules
  const usersWithRules = await prisma.alertRule.findMany({
    where: { enabled: true },
    select: { userId: true },
    distinct: ["userId"],
  });

  // Get users with enabled monitor alert settings
  const usersWithMonitor = await prisma.monitorAlertSettings.findMany({
    where: { enabled: true },
    select: { userId: true },
    distinct: ["userId"],
  });

  // Merge and deduplicate
  const userIds = new Set<string>();
  usersWithRules.forEach((u) => userIds.add(u.userId));
  usersWithMonitor.forEach((u) => userIds.add(u.userId));

  return Array.from(userIds);
}

/**
 * Evaluate spike alerts for all users
 */
async function evaluateAllSpikeAlerts(): Promise<{
  usersChecked: number;
  rulesChecked: number;
  alertsFired: number;
}> {
  const prisma = getPrismaClient();
  const userIds = await getUsersToEvaluate();

  let totalRules = 0;
  let totalAlerts = 0;

  for (const userId of userIds) {
    try {
      // Count enabled rules for this user
      const userRules = await prisma.alertRule.count({
        where: { userId, enabled: true },
      });
      totalRules += userRules;

      // Evaluate spike alerts
      const alertsFired = await evaluateSpikeAlerts(userId);
      totalAlerts += alertsFired;

      if (alertsFired > 0) {
        console.log(
          `[SPIKE_EVAL] User ${userId}: ${alertsFired} alert(s) fired`
        );
      }
    } catch (error) {
      console.error(`[SPIKE_EVAL] Error for user ${userId}:`, error);
    }
  }

  return {
    usersChecked: userIds.length,
    rulesChecked: totalRules,
    alertsFired: totalAlerts,
  };
}

/**
 * Evaluate monitor alerts for all users
 * This requires current filter state which we don't have in background job
 * For now, we skip monitor alerts in cron and rely on client-side evaluation
 */
async function evaluateAllMonitorAlerts(): Promise<{
  usersChecked: number;
  settingsChecked: number;
  alertsFired: number;
}> {
  // Monitor alerts require current filter state from client
  // Skip for now in automated cron job
  // Client-side evaluation will handle this when filters change

  console.log(
    "[MONITOR_EVAL] Skipped - requires client filter state (evaluated client-side)"
  );

  return {
    usersChecked: 0,
    settingsChecked: 0,
    alertsFired: 0,
  };
}

/**
 * POST /api/alerts/evaluate
 * Evaluate all alert rules (spike + monitor)
 * 
 * Query params:
 * - type: "spike" | "monitor" | "all" (default: "all")
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Auth check
    if (!isAuthorized(request)) {
      console.error("[ALERT_EVAL] Unauthorized request");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "all";

    console.log(`[ALERT_EVAL] ========== START (type: ${type}) ==========`);

    let spikeResults = null;
    let monitorResults = null;

    // Evaluate spike alerts
    if (type === "spike" || type === "all") {
      console.log("[ALERT_EVAL] Evaluating spike alerts...");
      spikeResults = await evaluateAllSpikeAlerts();
      console.log(
        `[ALERT_EVAL] Spike results: ${spikeResults.usersChecked} users, ${spikeResults.rulesChecked} rules, ${spikeResults.alertsFired} alerts fired`
      );
    }

    // Evaluate monitor alerts
    if (type === "monitor" || type === "all") {
      console.log("[ALERT_EVAL] Evaluating monitor alerts...");
      monitorResults = await evaluateAllMonitorAlerts();
      console.log(
        `[ALERT_EVAL] Monitor results: ${monitorResults.usersChecked} users, ${monitorResults.settingsChecked} settings, ${monitorResults.alertsFired} alerts fired`
      );
    }

    const duration = Date.now() - startTime;
    console.log(
      `[ALERT_EVAL] ========== END (${duration}ms) ==========`
    );

    return NextResponse.json({
      success: true,
      duration,
      spike: spikeResults,
      monitor: monitorResults,
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[ALERT_EVAL] ERROR after ${duration}ms:`, error);

    return NextResponse.json(
      {
        error: error.message || "Failed to evaluate alerts",
        duration,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/alerts/evaluate
 * Health check / manual trigger
 */
export async function GET(request: NextRequest) {
  // Allow GET for health check without auth
  return NextResponse.json({
    status: "ready",
    message: "Use POST to trigger evaluation",
    env: {
      hasSecret: !!process.env.ALERT_EVAL_SECRET,
    },
  });
}
