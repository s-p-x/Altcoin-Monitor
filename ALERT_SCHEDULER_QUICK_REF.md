# Alert Evaluation - Quick Reference

## 🚀 Quick Start

### Production (Vercel)
```bash
# 1. Add env var in Vercel Dashboard
ALERT_EVAL_SECRET=your_random_secret

# 2. Deploy
git push

# 3. Verify at: Vercel Dashboard → Crons
```

### Local Development
```bash
# Terminal 1
npm run dev

# Terminal 2
node scripts/alert-worker.js
```

---

## 📋 What It Does

### Spike Alerts
- ✅ Runs every **1 minute** (Vercel) or **10 seconds** (local)
- ✅ Checks all enabled `AlertRule` records
- ✅ Fetches OHLCV from Binance
- ✅ Fires alert if `volume_ratio >= threshold` AND cooldown passed
- ✅ Sends in-app + Telegram notifications

### Monitor Alerts
- ⚠️ **Skipped in background job** (requires client filter state)
- ✅ Still works client-side when filters change
- 🔮 Future: Store filter state in DB for server-side evaluation

---

## 🔧 Manual Testing

### Health Check
```bash
curl http://localhost:3000/api/alerts/evaluate
# Returns: {"status":"ready","message":"Use POST to trigger evaluation"}
```

### Trigger Evaluation (Local)
```bash
# Spike alerts only
curl -X POST "http://localhost:3000/api/alerts/evaluate?type=spike" \
  -H "Authorization: Bearer dev_secret_123"

# All alerts
curl -X POST "http://localhost:3000/api/alerts/evaluate?type=all" \
  -H "Authorization: Bearer dev_secret_123"
```

### Trigger Evaluation (Production)
```bash
curl -X POST "https://your-app.vercel.app/api/alerts/evaluate?type=spike" \
  -H "Authorization: Bearer YOUR_SECRET"
```

---

## 📊 Expected Logs

### Success (No Alerts)
```
[ALERT_EVAL] ========== START (type: spike) ==========
[ALERT_EVAL] Evaluating spike alerts...
[ALERT_EVAL] Spike results: 3 users, 12 rules, 0 alerts fired
[ALERT_EVAL] ========== END (234ms) ==========
```

### Success (Alerts Fired)
```
[ALERT_EVAL] ========== START (type: spike) ==========
[ALERT_EVAL] Evaluating spike alerts...
[SPIKE_EVAL] User demo_user: 2 alert(s) fired
[SPIKE_EVAL] User user_abc123: 1 alert(s) fired
[ALERT_EVAL] Spike results: 3 users, 12 rules, 3 alerts fired
[ALERT_EVAL] ========== END (567ms) ==========
```

### Error
```
[SPIKE_EVAL] Error for user demo_user: Error: Symbol XYZUSDT not found on Binance
[ALERT_EVAL] ERROR after 123ms: Failed to evaluate alerts
```

---

## 🛡️ Security

| Environment | Auth Required | Secret |
|-------------|---------------|--------|
| Local (no env var) | ❌ No | None |
| Local (with env var) | ✅ Yes | `ALERT_EVAL_SECRET` |
| Production | ✅ Yes | `ALERT_EVAL_SECRET` |

**Generate secret:**
```bash
openssl rand -hex 32
```

---

## 🔍 Debugging

### Check Rules Are Enabled
```sql
SELECT * FROM "AlertRule" WHERE enabled = true;
```

### Check Recent Events
```sql
SELECT * FROM "AlertEvent" 
ORDER BY "triggeredAt" DESC 
LIMIT 10;
```

### Verify Binance API
```bash
curl "https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=1"
```

### Check Cooldown Status
Cooldowns are in-memory only. To reset:
1. Restart worker (local)
2. Redeploy (Vercel)

---

## 📁 Files

| File | Purpose |
|------|---------|
| `app/api/alerts/evaluate/route.ts` | Evaluation endpoint |
| `vercel.json` | Cron schedule |
| `scripts/alert-worker.js` | Local dev worker |
| `lib/alertEvaluator.ts` | Core evaluation logic (unchanged) |
| `lib/dbRepository.ts` | DB queries + `getAllUsers()` helper |

---

## ⏱️ Intervals

| Type | Vercel (Prod) | Local Worker | Why |
|------|---------------|--------------|-----|
| Spike | 1 min | 10 sec | Vercel cron min = 1 min |
| Monitor | ❌ Skipped | ❌ Skipped | Needs client filter state |

**Want faster than 1 minute in production?**
- Use external cron service (UptimeRobot, EasyCron)
- Self-host worker on VPS
- Vercel Edge Functions + streaming (complex)

---

## 🚨 Common Issues

### "Unauthorized"
→ Add `ALERT_EVAL_SECRET` to Vercel env vars and redeploy

### No alerts firing
→ Check rules are enabled + Binance API reachable + cooldown passed

### Worker not connecting
→ Ensure `npm run dev` is running on port 3000

### Alerts fire too frequently
→ Increase `cooldown_seconds` in alert rule (default: 300s)

---

## 📈 Monitoring

- **Vercel**: Dashboard → Deployments → Functions → Select invocation
- **Local**: Terminal output from `alert-worker.js`
- **Database**: Query `AlertEvent` table for history
- **UI**: Alerts tab → Events sub-tab

---

## 🔗 Related Docs

- Full setup: [ALERT_SCHEDULER_SETUP.md](ALERT_SCHEDULER_SETUP.md)
- Alert system overview: [ALERT_SYSTEM.md](ALERT_SYSTEM.md)
- Quick start: [ALERT_QUICKSTART.md](ALERT_QUICKSTART.md)
- API reference: [API_REFERENCE.md](API_REFERENCE.md)
