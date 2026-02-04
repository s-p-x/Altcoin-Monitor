/**
 * Alert Evaluation Endpoint
 * Triggered by external scheduler (e.g., cron-job.org) to evaluate all alert rules
 * 
 * Protected by x-alert-secret header
 * Uses Postgres advisory lock to prevent concurrent runs
 */

import { NextResponse, NextRequest } from "next/server";
import { getPrismaClient } from "@/lib/prismaClient";
import {
  evaluateSpikeAlerts,
} from "@/lib/alertEvaluator";

// Force Node.js runtime (not Edge)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Failed to evaluate alerts";
}

/**
 * Verify request using x-alert-secret header
 */
function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.ALERT_EVAL_SECRET;
  const headerSecret = req.headers.get("x-alert-secret");

  // Reject if no secret configured
  if (!secret) {
    console.error("[ALERT_EVAL] ALERT_EVAL_SECRET not configured");
    return false;
  }

  // Reject if header missing or wrong
  if (!headerSecret || headerSecret !== secret) {
    return false;
  }

  return true;
}

/**
 * Try to acquire Postgres advisory lock
 * Returns true if lock acquired, false if already locked
 */
async function tryAcquireAdvisoryLock(): Promise<boolean> {
  const prisma = getPrismaClient();
  const LOCK_ID = 987654321; // Arbitrary unique number for this lock

  try {
    const result = await prisma.$queryRaw<{ pg_try_advisory_lock: boolean }[]>`
      SELECT pg_try_advisory_lock(${LOCK_ID}) as pg_try_advisory_lock
    `;
    return result[0]?.pg_try_advisory_lock || false;
  } catch (error) {
    console.error("[ALERT_EVAL] Failed to acquire advisory lock:", error);
    return false;
  }
}

/**
 * Release Postgres advisory lock
 */
async function releaseAdvisoryLock(): Promise<void> {
  const prisma = getPrismaClient();
  const LOCK_ID = 987654321;

  try {
    await prisma.$queryRaw`SELECT pg_advisory_unlock(${LOCK_ID})`;
  } catch (error) {
    console.error("[ALERT_EVAL] Failed to release advisory lock:", error);
  }
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
  usersWithRules.forEach((u: { userId: string }) => userIds.add(u.userId));
  usersWithMonitor.forEach((u: { userId: string }) => userIds.add(u.userId));

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
 * Security:
 * - Requires x-alert-secret header matching ALERT_EVAL_SECRET env var
 * - Uses Postgres advisory lock to prevent concurrent runs
 * 
 * Returns:
 * - 401 if unauthorized
 * - 200 with skipped:true if already locked
 * - 200 with results if evaluation completed
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Auth check
    if (!isAuthorized(request)) {
      console.error("[ALERT_EVAL] Unauthorized: missing or invalid x-alert-secret header");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Try to acquire advisory lock
    const lockAcquired = await tryAcquireAdvisoryLock();
    if (!lockAcquired) {
      console.log("[ALERT_EVAL] Skipped - another evaluation is already running");
      return NextResponse.json({
        ok: true,
        skipped: "locked",
        message: "Another evaluation is already in progress",
      });
    }

    console.log("[ALERT_EVAL] ========== START ==========");

    let spikeResults = null;
    let monitorResults = null;

    try {
      // Evaluate spike alerts
      console.log("[ALERT_EVAL] Evaluating spike alerts...");
      spikeResults = await evaluateAllSpikeAlerts();
      console.log(
        `[ALERT_EVAL] Spike: ${spikeResults.rulesChecked} checked, ${spikeResults.alertsFired} fired`
      );

      // Evaluate monitor alerts (currently skipped - requires client filter state)
      console.log("[ALERT_EVAL] Evaluating monitor alerts...");
      monitorResults = await evaluateAllMonitorAlerts();
      console.log(
        `[ALERT_EVAL] Monitor: ${monitorResults.settingsChecked} checked, ${monitorResults.alertsFired} fired`
      );
    } finally {
      // Always release the lock
      await releaseAdvisoryLock();
    }

    const duration = Date.now() - startTime;
    console.log(`[ALERT_EVAL] ========== END (${duration}ms) ==========`);

    return NextResponse.json({
      ok: true,
      spike: {
        checked: spikeResults.rulesChecked,
        fired: spikeResults.alertsFired,
      },
      monitor: {
        checked: monitorResults.settingsChecked,
        fired: monitorResults.alertsFired,
      },
      ms: duration,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[ALERT_EVAL] ERROR after ${duration}ms:`, error);

    // Release lock on error
    try {
      await releaseAdvisoryLock();
    } catch (unlockError) {
      console.error("[ALERT_EVAL] Failed to release lock after error:", unlockError);
    }

    return NextResponse.json(
      {
        error: getErrorMessage(error),
        ms: duration,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/alerts/evaluate
 * Health check / manual trigger
 */
export async function GET() {
  // Allow GET for health check without auth
  return NextResponse.json({
    status: "ready",
    message: "Use POST to trigger evaluation",
    env: {
      hasSecret: !!process.env.ALERT_EVAL_SECRET,
    },
  });
}
