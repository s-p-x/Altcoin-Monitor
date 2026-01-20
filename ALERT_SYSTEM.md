# Alert System Implementation Guide

## Overview

This document describes the two-tier alert system implemented for the Leopard Altcoin Monitor:

1. **Monitor Tab Alerts**: Notifies when NEW coins appear on the Monitor filtered list
2. **Alerts Tab Spike Alerts**: Per-coin rules that trigger when volume spikes 2x or 3x vs baseline

## Architecture

### Data Models

#### AlertRule
Defines a user's volume spike alert configuration:
- `id`: Unique identifier
- `user_id`: User who created the rule
- `symbol`: Coin symbol (e.g., "BTC")
- `timeframes`: Array of timeframes to monitor (["1m", "5m", "1h", "4h", "1d"])
- `thresholds`: Volume spike thresholds (array of [2, 3])
- `baseline_n`: Rolling window for baseline calculation (default: 20)
- `cooldown_seconds`: Minimum time between alerts for same rule (default: 300)
- `enabled`: Whether the rule is active
- `created_at`/`updated_at`: Timestamps

#### AlertEvent
Record of an alert that was triggered:
- `id`: Unique identifier
- `rule_id`: Null for MONITOR_NEW, rule ID for SPIKE
- `type`: "MONITOR_NEW" or "SPIKE"
- `symbol`: Coin symbol
- `timeframe`: Null for MONITOR_NEW
- `threshold`: Null for MONITOR_NEW; 2 or 3 for SPIKE
- `ratio`: Null for MONITOR_NEW; current_vol/baseline_vol for SPIKE
- `monitor_filters`: JSON object with filter values (only for MONITOR_NEW)
- `triggered_at`: ISO timestamp
- `delivered_channels`: Array of delivery channels (["inApp", "telegram"])
- `status`: "triggered", "delivered", "dismissed", "snoozed"
- `user_id`: User who received the alert

#### MonitorAlertSettings
Persists monitor alert configuration per user + filter state:
- `id`: Unique identifier
- `user_id`: User who owns this setting
- `filter_signature`: SHA256 hash of filter values
- `enabled`: Whether new coin alerts are active
- `cooldown_seconds`: Minimum time between alerts (default: 600)
- `last_coin_ids`: Previous snapshot of coin IDs in filtered list
- `created_at`/`updated_at`: Timestamps

### Filter Signature

The filter signature is a stable hash of the active Monitor filters:

```typescript
filterSignature = SHA256(
  ${min_market_cap}|${max_market_cap}|${min_volume_24h}|${min_vol_mcap_pct}
)
```

This allows the system to:
- Detect when filters have changed
- Store separate baselines per filter state
- Prevent spam when filters are temporarily adjusted

## System Logic

### Monitor Alert Evaluation

**Trigger Condition**: A coin appears in the filtered list for the first time under a specific filter state.

**Process**:
1. Compute `filteredCoinIds` = coins currently visible after applying filters
2. Load `MonitorAlertSettings` for (userId, filterSignature)
3. Compare `filteredCoinIds` with `settings.last_coin_ids`
4. `newCoins` = `filteredCoinIds - last_coin_ids`
5. For each new coin:
   - Check cooldown (per coin + filter signature, default 10 minutes)
   - If passed, create AlertEvent with type="MONITOR_NEW"
   - Include filter values in alert payload
6. Update `last_coin_ids` with current snapshot

**Anti-Spam Strategy**: Cooldown per coin per filter signature
- Same coin won't alert twice within 10 minutes under same filters
- Different filter states are tracked separately
- Changing filters creates new baseline (no alert spam)

**Implementation Location**: `lib/alertEvaluator.ts` → `evaluateMonitorAlerts()`

### Spike Alert Evaluation

**Trigger Condition**: Volume ratio meets or exceeds 2x or 3x threshold.

**Process**:
1. For each enabled AlertRule:
   - For each timeframe in rule.timeframes:
     - Fetch `baselineVolume` = rolling average of last N candles
     - Fetch `currentVolume` = current candle volume
     - Calculate `ratio = currentVolume / baselineVolume`
2. **Threshold Evaluation** (in descending order):
   - If `ratio >= 3`:
     - Check cooldown for (rule_id, timeframe, 3x)
     - If passed, fire alert with threshold=3
     - **Skip 2x check** (3x suppresses 2x)
   - Else if `ratio >= 2`:
     - Check cooldown for (rule_id, timeframe, 2x)
     - If passed, fire alert with threshold=2
3. Create AlertEvent with type="SPIKE"

**Cooldown Strategy**: Per rule + timeframe + threshold
- Default: 5 minutes
- Each (rule_id, timeframe, threshold) combination has independent cooldown
- Example: BTC 1h 2x can alert at 10:00, again at 10:05. BTC 1h 3x independent.

**Implementation Location**: `lib/alertEvaluator.ts` → `evaluateSpikeAlerts()`

### Notification Delivery

The `NotificationProvider` interface supports multiple channels:

```typescript
interface INotificationProvider {
  send(userId: string, channel: NotificationChannel, payload: NotificationPayload): Promise<boolean>
  getStatus(userId: string, channel: NotificationChannel): Promise<boolean>
}
```

**Implemented Channels**:
- `inApp`: Stores notification in in-memory store, renders in Alerts tab
- `telegram`: Stubbed (TODO)

**Payload Structure**:
```typescript
type NotificationPayload = {
  type: AlertType
  symbol: string
  timeframe?: string | null
  threshold?: number | null
  ratio?: number | null
  monitor_filters?: MonitorAlertFilters | null
  triggeredAt: string
  ruleId?: string | null
}
```

**Implementation Location**: `lib/notificationProvider.ts`

## API Routes

### Monitor Alert Settings
```
GET  /api/alerts/monitor?userId=X&minMarketCap=X&maxMarketCap=X&minVolume=X&minVolMcapPct=X
PUT  /api/alerts/monitor { userId, filters, enabled, cooldown_seconds }
```

### Alert Rules (CRUD)
```
GET    /api/alerts/rules?userId=X
POST   /api/alerts/rules { userId, symbol, timeframes, thresholds, baseline_n, cooldown_seconds }
PUT    /api/alerts/rules { id, enabled, ...updates }
DELETE /api/alerts/rules?id=X
```

### Alert Events (Read-only)
```
GET /api/alerts/events?userId=X&limit=50
```

**Implementation Location**: `app/api/alerts/*/route.ts`

## UI Components

### MonitorAlertSettingsPanel
**Location**: `app/components/MonitorAlertSettingsPanel.tsx`

**Features**:
- Toggle to enable/disable new coin alerts
- Cooldown dropdown (1m, 5m, 10m, 30m, 60m)
- Read-only display of current filter values
- In-app delivery toggle (always on)
- Telegram placeholder (coming soon)

**Props**:
```typescript
interface MonitorAlertSettingsPanelProps {
  userId: string
  filters: FilterSignatureInput
  onSettingsChange?: (settings: Partial<MonitorAlertSettings>) => void
  loading?: boolean
}
```

**Behavior**:
- Fetches settings on mount and when filters change
- Uses optimistic UI for toggling
- Shows error messages if API calls fail

### Alerts Tab (Enhanced)
**Location**: `app/components/Alerts.tsx`

**Tabs**:
1. **Rules Tab**:
   - "Create New Rule" button expands form
   - Form fields: symbol, timeframes (checkboxes), thresholds (2x/3x toggles)
   - Advanced options: baseline_n, cooldown (collapsible)
   - Rules list with enable/disable toggle, delete button
   - Optimistic UI for all operations

2. **Events Tab**:
   - Read-only list of recent alert events
   - Events show symbol, type (Spike/New Coin), threshold/ratio, timestamp
   - For MONITOR_NEW events: displays filter context
   - Delivery status indicator (📱 for in-app)
   - Auto-refreshes every 5 seconds

**Client-Side Polling**: Every 5 seconds, fetches new events (only appends deltas in production)

## Testing

**Test Harness**: `lib/alertTests.ts`

**Tests Included**:

1. **testNewCoinDetection()**: Verify new coins fire alerts, same coins don't repeat
2. **testFilterChangeWarmup()**: Verify filter signature changes create new baseline
3. **testCooldownEnforcement()**: Verify cooldown blocks repeated alerts
4. **testSpikeThresholdLogic()**: Verify 3x suppresses 2x

**Run Tests**:
```bash
# In Node.js environment:
node -r ts-node/register lib/alertTests.ts
```

## Configuration

### Default Values

| Setting | Default | Configurable |
|---------|---------|-------------|
| Monitor alert cooldown | 600s (10m) | Yes, via dropdown |
| Spike rule cooldown | 300s (5m) | Yes, via form |
| Baseline window (N) | 20 candles | Yes, advanced option |
| Event polling interval | 5s | No (client-side) |
| Filter thresholds | 2x, 3x | No (hardcoded for now) |

## TODOs

### High Priority
- [ ] Integrate actual OHLCV data for baseline/current volume
- [ ] Implement Telegram notification delivery
- [ ] Add persistence layer (database instead of in-memory)
- [ ] Wire up authentication (replace "demo_user" with real user ID)

### Medium Priority
- [ ] Add WebSocket/SSE for real-time event delivery (instead of polling)
- [ ] Implement 2-refresh confirmation for filter changes (reduce spam)
- [ ] Add email notifications
- [ ] Create admin dashboard to view all alerts

### Nice to Have
- [ ] Alert rules bulk import/export (JSON)
- [ ] Alert history with detailed analytics
- [ ] Custom webhook delivery
- [ ] Advanced rule syntax (e.g., combine multiple conditions)

## Code Organization

```
lib/
  types.ts              # Type definitions (AlertRule, AlertEvent, etc.)
  alertStore.ts         # In-memory data store + cooldown tracking
  alertEvaluator.ts     # Evaluation logic (new coins, spikes, cooldowns)
  notificationProvider.ts  # Notification delivery interface
  alertTests.ts         # Test harness

app/
  api/alerts/
    rules/route.ts      # Alert rules CRUD endpoints
    events/route.ts     # Alert events retrieval
    monitor/route.ts    # Monitor settings endpoints
  components/
    MonitorAlertSettingsPanel.tsx  # Monitor tab alert controls
    Alerts.tsx          # Full Alerts tab with rules + events
```

## Performance Considerations

- **In-memory Storage**: Suitable for demo/MVP. Replace with database for production.
- **Event Polling**: Every 5 seconds. Consider WebSocket/SSE for lower latency.
- **Cooldown Tracking**: Uses in-memory Map. Survives across requests in Node.js; lost on serverless cold starts.
- **Filter Signature Hashing**: SHA256 done in JavaScript (acceptable for monitoring app).

## Future Enhancements

1. **Spike Detection from Exchange Streams**: Instead of polling for OHLCV, subscribe to exchange WebSocket for real-time volume updates.
2. **Machine Learning Baseline**: Use more sophisticated rolling window vs simple average.
3. **Multi-Exchange Support**: Track same coin across multiple exchanges, aggregate spikes.
4. **User Preferences**: Allow per-user notification channels, quiet hours, alert summarization.
5. **Backtesting**: Historical alert simulation to tune thresholds.

## References

- **Monitor Filters**: min_market_cap, max_market_cap, min_volume_24h, min_vol_mcap_pct
- **Timeframes**: 1m, 5m, 15m, 1h, 4h, 1d (extensible)
- **Thresholds**: 2x, 3x (extensible)
- **Delivery Channels**: inApp (✅ implemented), telegram (🔄 stubbed)
