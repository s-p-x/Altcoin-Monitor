/**
 * Local Alert Evaluation Worker
 * FOR LOCAL DEVELOPMENT ONLY
 * 
 * In production, Vercel Cron handles this automatically.
 * Run this script locally to simulate automated alert evaluation.
 * 
 * Usage:
 *   npm run dev (in one terminal)
 *   node scripts/alert-worker.js (in another terminal)
 */

const EVAL_ENDPOINT = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
const EVAL_SECRET = process.env.ALERT_EVAL_SECRET || "dev_secret_123";
const SPIKE_INTERVAL_MS = 10000; // 10 seconds
const MONITOR_INTERVAL_MS = 60000; // 60 seconds

let spikeTimer = null;
let monitorTimer = null;

/**
 * Call evaluation endpoint
 */
async function triggerEvaluation(type) {
  try {
    const url = `${EVAL_ENDPOINT}/api/alerts/evaluate?type=${type}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${EVAL_SECRET}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`[WORKER] ${type} evaluation failed:`, error);
      return;
    }

    const result = await response.json();
    const emoji = result[type]?.alertsFired > 0 ? "🔥" : "✓";
    console.log(
      `[WORKER] ${emoji} ${type.toUpperCase()}: ${result[type]?.alertsFired || 0} alerts (${result.duration}ms)`
    );
  } catch (error) {
    console.error(`[WORKER] ${type} evaluation error:`, error.message);
  }
}

/**
 * Start worker
 */
function start() {
  console.log("========================================");
  console.log("  ALERT EVALUATION WORKER (LOCAL DEV)");
  console.log("========================================");
  console.log(`Endpoint: ${EVAL_ENDPOINT}`);
  console.log(`Spike interval: ${SPIKE_INTERVAL_MS}ms`);
  console.log(`Monitor interval: ${MONITOR_INTERVAL_MS}ms`);
  console.log("Press Ctrl+C to stop");
  console.log("========================================\n");

  // Initial evaluation
  triggerEvaluation("spike");
  triggerEvaluation("monitor");

  // Schedule recurring evaluations
  spikeTimer = setInterval(() => {
    triggerEvaluation("spike");
  }, SPIKE_INTERVAL_MS);

  monitorTimer = setInterval(() => {
    triggerEvaluation("monitor");
  }, MONITOR_INTERVAL_MS);
}

/**
 * Stop worker
 */
function stop() {
  console.log("\n[WORKER] Shutting down...");
  if (spikeTimer) clearInterval(spikeTimer);
  if (monitorTimer) clearInterval(monitorTimer);
  process.exit(0);
}

// Handle shutdown
process.on("SIGINT", stop);
process.on("SIGTERM", stop);

// Start
start();
