## Quick Start: Alert System

### What Was Built

Two complementary alert systems integrated into the Leopard Altcoin Monitor:

1. **Monitor Tab Alerts** 🆕
   - Notifies when coins ENTER your filtered list
   - Filter-aware (only alerts under current filter state)
   - Anti-spam with per-coin cooldown

2. **Spike Alerts** ⚡
   - Per-coin rules for 2x/3x volume spikes
   - Multi-timeframe support (1m through 1d)
   - Per-rule cooldowns

### Key Features

✅ **Monitor Alerts**
- Toggle: "Alert when new coins appear (under current filters)"
- Cooldown options: 1m, 5m, 10m, 30m, 1h
- Filter summary displayed (shows exact filter state tracked)
- In-app notifications + Alerts tab log

✅ **Spike Rules**
- Create per-coin rules with symbol, timeframes, thresholds
- Advanced options: baseline window size, custom cooldown
- Rules list with enable/disable toggle
- Delete rules anytime

✅ **Alert Events Log**
- Real-time list of fired alerts
- Shows trigger details (threshold met, ratio, timeframe)
- For Monitor alerts: displays filter context
- Auto-refreshes every 5s

✅ **Notifications**
- In-app toast + persistent log
- [TODO] Telegram integration stub in place

---

## Usage Guide

### Monitor Alerts (On Monitor Tab)

1. Set your preferred filters (Min MC, Max MC, Min Vol, Vol/MC%)
2. Scroll down to find the **"Monitor Alerts (New Coins)"** panel
3. **Toggle ON** to enable alerts when new coins enter your filtered list
4. **Select cooldown** (how long to wait before alerting same coin again)
5. **Read-only filter summary** shows exactly what you're tracking

**Example**: 
- Filters: Min MC=$100M, Max MC=$1B, Min Vol=$50M
- You enable alerts with 10m cooldown
- Coin "XYZ" appears in Monitor list → Alert fires! 🔔
- XYZ drops below filters → Re-enters 15 minutes later → Alert fires again!

### Spike Alerts (On Alerts Tab → Rules)

1. Click **"Create New Rule"**
2. **Enter coin symbol** (e.g., BTC, ETH, SOL)
3. **Select timeframes** (1m, 5m, 15m, 1h, 4h, 1d - multi-select)
4. **Toggle thresholds** (2x, 3x or both)
5. **Advanced** (optional):
   - Baseline window: how many candles to average (default 20)
   - Cooldown: min time between alerts (default 5m)
6. **Create Rule** ✅

Now the rule actively monitors. When volume spikes >= your threshold:
- Alert fires 🔔
- Event logged in "Events" tab
- Cooldown blocks spam (won't fire again for threshold + rule combo for N seconds)

### Viewing Alerts

**Alerts Tab → Events**:
- **Spike events**: Symbol, threshold hit (2x/3x), actual ratio, timeframe, time
- **Monitor events**: Symbol, filter context (Min MC, Max MC, Vol, Vol/MC%)
- 📱 indicator shows in-app delivery confirmed

---

## Developer Guide

### File Structure

```
lib/
├── types.ts                   # Type definitions
├── alertStore.ts              # Data store + cooldown tracking
├── alertEvaluator.ts          # Evaluation logic
├── notificationProvider.ts    # Notification delivery
└── alertTests.ts              # Test harness

app/
├── api/alerts/
│   ├── rules/route.ts         # POST/PUT/GET/DELETE rules
│   ├── events/route.ts        # GET alert events
│   └── monitor/route.ts       # GET/PUT monitor settings
└── components/
    ├── MonitorAlertSettingsPanel.tsx  # Monitor tab UI
    └── Alerts.tsx              # Alerts tab UI
```

### Adding Monitor Alert Evaluation

If you want to call the evaluator (e.g., after each Monitor refresh):

```typescript
import { evaluateMonitorAlerts } from '@/lib/alertEvaluator';

// After fetching and filtering coins:
const coinDataMap = new Map(
  coins.map(coin => [coin.id, { symbol: coin.symbol, name: coin.name }])
);

const alertsFired = await evaluateMonitorAlerts(
  userId,
  filteredCoins.map(c => c.id), // coin IDs currently visible
  {
    min_market_cap: filters.minMarketCap,
    max_market_cap: filters.maxMarketCap,
    min_volume_24h: filters.minVolume,
    min_vol_mcap_pct: filters.minVolumeChange,
  },
  coinDataMap
);

console.log(`${alertsFired} new coin alerts fired`);
```

### Testing

```bash
# Run test harness
node -r ts-node/register lib/alertTests.ts

# Expected output:
# 🧪 ALERT SYSTEM TEST HARNESS
# === TEST 1: New Coin Detection ===
# ...
# === SUMMARY ===
# ✅ ALL TESTS PASSED
```

### Integrating Telegram

1. In `lib/notificationProvider.ts`, update `TelegramNotificationProvider`:

```typescript
export class TelegramNotificationProvider implements INotificationProvider {
  async send(userId: string, channel: NotificationChannel, payload: NotificationPayload): Promise<boolean> {
    if (channel !== "telegram") return false;

    // TODO: 
    // 1. Look up user's Telegram chat ID from database
    // 2. Call Telegram Bot API
    // 3. Handle errors

    const chatId = await getUserTelegramChatId(userId);
    if (!chatId) return false;

    const message = this.formatMessage(payload);
    return await telegramBot.sendMessage(chatId, message);
  }
}
```

2. Wire up at app launch (register webhook for Telegram updates)

### Performance Notes

- **In-memory storage**: OK for MVP, replace with DB for production
- **Cooldown tracking**: Lives in memory; resets on server restart (document this!)
- **Event polling**: 5s interval. Consider WebSocket for <1s latency
- **Filter hashing**: SHA256 in JS (acceptable, but could cache)

### Debugging

Enable console logging:
```typescript
// In alertEvaluator.ts
console.log(`[DEBUG] Evaluating ${newCoinIds.length} new coins`);
console.log(`[DEBUG] Cooldown passed: ${coinId}`);
```

Check in-app store:
```typescript
import { notificationProvider } from '@/lib/notificationProvider';
const provider = notificationProvider.getInAppProvider();
const notifs = provider.getUserNotifications(userId);
console.log(notifs);
```

---

## Known Limitations

⚠️ **Current Implementation**:
- In-memory storage (not persisted to database)
- Cooldown tracking lost on server restart
- User ID hardcoded as "demo_user" (need auth)
- OHLCV data fetching stubbed (returns dummy values)
- Telegram notifications stubbed

✅ **Fully Working**:
- Monitor new coin detection + anti-spam
- Spike rule CRUD and storage
- Alert event creation and logging
- In-app notifications
- UI for both alert types
- Filter signature + cooldown logic

---

## Next Steps (Priority Order)

1. **Add auth**: Replace "demo_user" with real `req.user.id`
2. **Integrate OHLCV data**: Fetch real candle data for baseline/current volume
3. **Telegram setup**: Get bot token, store user chat IDs, implement send
4. **Persistence**: Move from in-memory to Supabase/Postgres
5. **WebSocket**: Real-time event delivery instead of polling

---

## FAQ

**Q: Why doesn't the Monitor alert fire for all coins?**
A: It only fires for NEW coins entering the list under the current filter state. Coins already in the list won't alert again.

**Q: Can I have different alert settings for different filter combinations?**
A: Yes! Each unique filter combination gets its own baseline. Change filters → new baseline automatically created.

**Q: Will 2x alert fire if 3x already fired?**
A: No. If volume is 3.5x, only the 3x alert fires. The 2x is suppressed (logic in `evaluateSpikeAlerts`).

**Q: How do I test without real volume data?**
A: Currently using dummy data. Update `getBaselineVolume()` and `getCurrentVolume()` in `alertEvaluator.ts` to fetch real data or mock with test values.

**Q: Can I set alerts for the same coin on multiple timeframes?**
A: Yes! One rule can monitor multiple timeframes (checkboxes in form). Each timeframe has independent cooldown.

---

## Support

See `ALERT_SYSTEM.md` for detailed technical documentation.
