# Alert Evaluation Scheduler - Setup Guide

## Overview

Alert evaluation is now automated via **Vercel Cron** (production) or **local worker script** (development).

### What Was Added

1. **API Endpoint**: `/api/alerts/evaluate` - Triggers alert evaluation
2. **Vercel Cron Config**: `vercel.json` - Schedules automatic execution
3. **Local Worker**: `scripts/alert-worker.js` - Simulates cron for local dev

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      PRODUCTION (Vercel)                         │
│  Vercel Cron → POST /api/alerts/evaluate → evaluateSpikeAlerts  │
│  Every 1 minute                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                   LOCAL DEVELOPMENT (Node.js)                    │
│  scripts/alert-worker.js → POST localhost:3000/api/alerts/      │
│  evaluate → evaluateSpikeAlerts                                  │
│  Every 10 seconds (spike) / 60 seconds (monitor)                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Setup Instructions

### 1. Environment Variables

Add to your `.env` or Vercel environment variables:

```bash
# Required for production (optional for dev)
ALERT_EVAL_SECRET=your_random_secret_here_abc123xyz789

# Already configured (no changes needed)
DATABASE_URL=your_postgres_connection_string
TELEGRAM_BOT_TOKEN=optional_for_telegram_notifications
```

**Generate a secure secret:**
```bash
# Linux/Mac
openssl rand -hex 32

# PowerShell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

### 2. Vercel Deployment

**A. Add Environment Variable**

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add:
   - Name: `ALERT_EVAL_SECRET`
   - Value: Your generated secret
   - Environments: ✓ Production, ✓ Preview, ✓ Development

**B. Deploy**

```bash
# Commit the new files
git add vercel.json app/api/alerts/evaluate/route.ts
git commit -m "Add automated alert evaluation"
git push

# Vercel will auto-deploy
```

**C. Verify Cron Job**

1. Go to Vercel Dashboard → Your Project → Crons
2. You should see: `/api/alerts/evaluate?type=spike` scheduled every 1 minute
3. Check logs in **Deployments → [latest] → Functions** to see execution logs

---

### 3. Local Development

**Option A: Run Local Worker (Recommended)**

```bash
# Terminal 1: Start Next.js dev server
npm run dev

# Terminal 2: Start alert worker
node scripts/alert-worker.js
```

You'll see output like:
```
========================================
  ALERT EVALUATION WORKER (LOCAL DEV)
========================================
Endpoint: http://localhost:3000
Spike interval: 10000ms
Monitor interval: 60000ms
Press Ctrl+C to stop
========================================

[WORKER] ✓ SPIKE: 0 alerts (123ms)
[WORKER] ✓ MONITOR: 0 alerts (45ms)
[WORKER] 🔥 SPIKE: 2 alerts (234ms)  ← Alert fired!
```

**Option B: Manual Trigger via cURL**

```bash
# Check endpoint status
curl http://localhost:3000/api/alerts/evaluate

# Trigger evaluation (with auth)
curl -X POST http://localhost:3000/api/alerts/evaluate?type=spike \
  -H "Authorization: Bearer dev_secret_123"

# Or without secret in dev mode (if ALERT_EVAL_SECRET not set)
curl -X POST http://localhost:3000/api/alerts/evaluate?type=all
```

---

## How It Works

### Spike Alert Evaluation

1. **Fetch users** with enabled alert rules from database
2. **For each user**:
   - Get all enabled `AlertRule` records
   - Call `evaluateSpikeAlerts(userId)`
3. **Inside evaluateSpikeAlerts**:
   - For each rule, fetch OHLCV candles from Binance
   - Calculate `ratio = current_volume / baseline_volume`
   - If `ratio >= threshold` AND cooldown passed:
     - Create `AlertEvent` in database
     - Send notification (in-app, Telegram)
4. **Log results**: Users checked, rules evaluated, alerts fired

### Monitor Alert Evaluation

**Current Status: Skipped in Cron**

Monitor alerts require real-time filter state from the client (min market cap, max market cap, etc.). Since Vercel Cron doesn't have access to user filter state, monitor alerts are:

- ✅ Evaluated **client-side** when filters change (existing behavior)
- ❌ NOT evaluated in background cron (requires filter context)

**Future Enhancement:** Store last-known filter state per user in database and evaluate server-side.

---

## Scheduling Details

### Vercel Cron Syntax

```json
{
  "crons": [
    {
      "path": "/api/alerts/evaluate?type=spike",
      "schedule": "*/1 * * * *"  // Every 1 minute
    }
  ]
}
```

**Why not every 10 seconds?**
- Vercel Cron minimum interval: **1 minute**
- For sub-minute execution, use:
  - Vercel Edge Functions with streaming (complex)
  - External cron service (UptimeRobot, EasyCron)
  - Self-hosted worker (see Local Development)

**Recommendation for Production:**
- Keep Vercel Cron at 1 minute (sufficient for most use cases)
- Cooldown logic prevents alert spam
- Users get timely alerts without overwhelming API costs

### Local Worker Intervals

```javascript
const SPIKE_INTERVAL_MS = 10000;   // 10 seconds
const MONITOR_INTERVAL_MS = 60000; // 60 seconds
```

Adjust in `scripts/alert-worker.js` as needed.

---

## Security

### Authentication

The endpoint is protected by `ALERT_EVAL_SECRET`:

```typescript
// Request must include:
Authorization: Bearer YOUR_SECRET_HERE
```

**Dev Mode (No Secret Set):**
- If `ALERT_EVAL_SECRET` is undefined, endpoint allows unauthenticated requests
- Logs warning: "No ALERT_EVAL_SECRET set - running in dev mode"

**Production Mode (Secret Set):**
- All requests MUST include valid Bearer token
- Returns 401 Unauthorized if missing/invalid

### Vercel Cron Security

Vercel automatically includes a verification header when calling cron endpoints. Our implementation uses Bearer token for simplicity and manual testing.

---

## Monitoring & Logs

### Vercel Production Logs

View in Vercel Dashboard → Deployments → [latest] → Functions:

```
[ALERT_EVAL] ========== START (type: spike) ==========
[ALERT_EVAL] Evaluating spike alerts...
[SPIKE_EVAL] User demo_user: 2 alert(s) fired
[ALERT_EVAL] Spike results: 3 users, 12 rules, 2 alerts fired
[ALERT_EVAL] ========== END (345ms) ==========
```

### Local Worker Logs

```
[WORKER] ✓ SPIKE: 0 alerts (123ms)
[WORKER] 🔥 SPIKE: 2 alerts (234ms)
```

### Alert Event History

Check fired alerts in UI:
1. Go to **Alerts** tab
2. Click **Events** sub-tab
3. See all triggered alerts with timestamps

Or query database directly:
```sql
SELECT * FROM "AlertEvent" ORDER BY "triggeredAt" DESC LIMIT 20;
```

---

## Troubleshooting

### "Unauthorized" error in production

- Verify `ALERT_EVAL_SECRET` is set in Vercel env vars
- Redeploy after adding env var
- Check Vercel cron is using same secret (auto-injected)

### No alerts firing despite active rules

1. **Check rules are enabled:**
   ```sql
   SELECT * FROM "AlertRule" WHERE enabled = true;
   ```

2. **Verify Binance API access:**
   ```bash
   curl https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=1
   ```

3. **Check cooldown hasn't blocked alerts:**
   - Default cooldown: 300 seconds (5 minutes)
   - Wait 5+ minutes and re-run evaluation

4. **Review logs for errors:**
   - Vercel: Deployments → Functions → Select invocation
   - Local: Check terminal output

### Worker script not connecting

- Ensure `npm run dev` is running
- Check `NEXT_PUBLIC_BASE_URL` is set correctly (or defaults to localhost:3000)
- Verify no firewall blocking port 3000

---

## Performance Considerations

### API Rate Limits

**Binance (OHLCV data):**
- Free tier: 1200 requests/minute
- Our cache: 5-second TTL
- With 50 rules checking 5 timeframes each: ~250 requests/minute (well within limit)

**Database (PostgreSQL):**
- Vercel cron: 1 invocation/minute = ~1440 queries/day (negligible)
- No special optimizations needed at this scale

### Cost Estimation

**Vercel:**
- Cron executions: Free (included in all plans)
- Function invocations: ~43,800/month (1/min × 60 × 24 × 30.5)
- Pro plan: 1M invocations included (plenty of headroom)

**Binance API:**
- Free, no authentication required

**PostgreSQL:**
- Depends on your provider (Vercel Postgres, Supabase, etc.)
- Alert table growth: ~1-10 events/day per user (minimal storage)

---

## Next Steps

### Enhancements

1. **WebSocket for Real-Time Alerts**
   - Replace client-side polling with Server-Sent Events (SSE)
   - Push alerts instantly when fired

2. **Monitor Alert Background Evaluation**
   - Store last filter state per user in DB
   - Evaluate monitor alerts in cron job

3. **Alert History Cleanup**
   - Add cron job to archive/delete old events (>30 days)
   - Prevent infinite table growth

4. **Multi-Exchange Support**
   - Add Coinbase, Kraken, Bybit for redundancy
   - Fallback if Binance API fails

5. **Advanced Scheduling**
   - Different intervals per timeframe (1m rules → 10s check, 1d rules → 5m check)
   - Dynamic scheduling based on rule priority

---

## Files Modified/Created

```
app/api/alerts/evaluate/route.ts   ← NEW: Evaluation endpoint
vercel.json                         ← NEW: Vercel cron config
scripts/alert-worker.js             ← NEW: Local dev worker
ALERT_SCHEDULER_SETUP.md            ← NEW: This file
```

No existing files were modified (preserves all cooldown/dedupe logic).

---

## Support

- **Vercel Cron Docs**: https://vercel.com/docs/cron-jobs
- **Next.js API Routes**: https://nextjs.org/docs/app/building-your-application/routing/route-handlers
- **Binance API**: https://binance-docs.github.io/apidocs/spot/en/

For issues, check:
1. Vercel function logs (production)
2. Terminal output (local dev)
3. Database for alert events/rules
