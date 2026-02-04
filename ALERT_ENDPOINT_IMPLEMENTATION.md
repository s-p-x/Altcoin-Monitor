# Alert Evaluation Endpoint - Implementation Summary

## ✅ Complete

Secure Vercel API route for triggering alert evaluations has been implemented.

## File Modified

**[app/api/alerts/evaluate/route.ts](app/api/alerts/evaluate/route.ts)**

## Implementation Details

### Security

✅ **Header-based authentication**
- Checks `x-alert-secret` header against `ALERT_EVAL_SECRET` env var
- Returns `401 Unauthorized` if missing or wrong
- Rejects if `ALERT_EVAL_SECRET` not configured (no dev mode bypass)

✅ **Postgres advisory lock**
- Uses `pg_try_advisory_lock(987654321)` to prevent concurrent runs
- Non-blocking: Returns immediately if another evaluation is running
- Returns `{ ok: true, skipped: "locked" }` if locked
- Lock always released in `finally` block (even on error)

✅ **Node runtime**
- Explicitly set `export const runtime = "nodejs"`
- Ensures full Postgres/Prisma support (not Edge)

### API Behavior

**POST /api/alerts/evaluate**

**Request:**
```bash
curl -X POST https://your-app.vercel.app/api/alerts/evaluate \
  -H "x-alert-secret: your-secret-here"
```

**Success Response (evaluation ran):**
```json
{
  "ok": true,
  "spike": {
    "checked": 5,
    "fired": 2
  },
  "monitor": {
    "checked": 0,
    "fired": 0
  },
  "ms": 1234
}
```

**Success Response (already running):**
```json
{
  "ok": true,
  "skipped": "locked",
  "message": "Another evaluation is already in progress"
}
```

**Error Response (unauthorized):**
```json
{
  "error": "Unauthorized"
}
```
Status: `401`

**Error Response (evaluation failed):**
```json
{
  "error": "Failed to evaluate alerts",
  "ms": 500
}
```
Status: `500`

**GET /api/alerts/evaluate (health check):**
```json
{
  "status": "ready",
  "message": "Use POST to trigger evaluation",
  "env": {
    "hasSecret": true
  }
}
```

### Evaluation Flow

1. **Verify auth** - Check `x-alert-secret` header
2. **Acquire lock** - Try Postgres advisory lock
   - If locked → Return `{ ok: true, skipped: "locked" }`
3. **Evaluate spike alerts**
   - Fetch all users with enabled alert rules
   - For each user, call `evaluateSpikeAlerts(userId)`
   - Check volume spikes vs thresholds
   - Respect cooldowns
   - Send notifications (in-app + Telegram)
4. **Evaluate monitor alerts**
   - Currently skipped (requires client filter state)
5. **Release lock** - Always in `finally` block
6. **Return results** - Counts + duration

### Logging

Console logs provide detailed tracking:

```
[ALERT_EVAL] ========== START ==========
[ALERT_EVAL] Evaluating spike alerts...
[SPIKE_EVAL] User demo_user: 2 alert(s) fired
[ALERT_EVAL] Spike: 5 checked, 2 fired
[ALERT_EVAL] Monitor: 0 checked, 0 fired
[ALERT_EVAL] ========== END (1234ms) ==========
```

If locked:
```
[ALERT_EVAL] Skipped - another evaluation is already running
```

If unauthorized:
```
[ALERT_EVAL] Unauthorized: missing or invalid x-alert-secret header
```

## Setup Instructions

### 1. Set Environment Variable

**Via Vercel Dashboard:**
1. Go to your project → Settings → Environment Variables
2. Add: `ALERT_EVAL_SECRET` = `your-random-secret-here-abc123xyz`
3. Save and redeploy

**Via Vercel CLI:**
```bash
vercel env add ALERT_EVAL_SECRET
# Paste your secret when prompted
vercel --prod
```

### 2. Deploy
```bash
git add .
git commit -m "Add secure alert evaluation endpoint"
git push
```

### 3. Configure External Cron

**Recommended: [cron-job.org](https://cron-job.org)**

1. Create account
2. Add new cron job:
   - **URL:** `https://your-app.vercel.app/api/alerts/evaluate`
   - **Method:** POST
   - **Schedule:** `*/10 * * * * *` (every 10 seconds)
   - **Headers:** 
     ```
     x-alert-secret: your-random-secret-here-abc123xyz
     ```
3. Save and enable

**Alternative services:**
- EasyCron
- AWS EventBridge
- Google Cloud Scheduler
- Render Cron Jobs

### 4. Test

```bash
# Health check (no auth required)
curl https://your-app.vercel.app/api/alerts/evaluate

# Trigger evaluation
curl -X POST https://your-app.vercel.app/api/alerts/evaluate \
  -H "x-alert-secret: your-secret-here"
```

## Code Quality

✅ No TypeScript errors  
✅ Proper error handling with try/catch/finally  
✅ Lock always released (even on error)  
✅ Comprehensive logging  
✅ Clear response format  
✅ Node runtime for Postgres support  

## Integration with Existing Code

✅ Uses existing `evaluateSpikeAlerts()` from [lib/alertEvaluator.ts](lib/alertEvaluator.ts)  
✅ Uses existing `evaluateMonitorAlerts()` (currently skips - requires client state)  
✅ No changes to evaluation logic  
✅ No changes to notification system  
✅ Maintains existing cooldown behavior  

## What Was NOT Done (Per Requirements)

❌ No Vercel Cron config added  
❌ No `vercel.json` cron schedule  
❌ No changes to evaluation logic  
❌ No changes to notification system  

## Environment Variables Required

| Variable | Purpose | Example |
|----------|---------|---------|
| `ALERT_EVAL_SECRET` | Auth secret for cron endpoint | `abc123xyz789` |
| `DATABASE_URL` | Postgres connection (auto-set by Vercel) | `postgresql://...` |

## Next Steps

1. ✅ Set `ALERT_EVAL_SECRET` in Vercel
2. ✅ Deploy to production
3. ⏳ Configure external cron service (cron-job.org recommended)
4. ⏳ Test manually
5. ⏳ Monitor Vercel logs

---

**Implementation Date:** February 4, 2026  
**Status:** ✅ Complete and ready for deployment
