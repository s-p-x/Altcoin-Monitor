# Alert System API Reference

## Quick Function Reference

### Type Imports
```typescript
import {
  AlertType,           // "MONITOR_NEW" | "SPIKE"
  AlertStatus,         // "triggered" | "delivered" | "dismissed" | "snoozed"
  AlertRule,           // User's spike alert rule
  AlertEvent,          // Alert event record
  MonitorAlertSettings,// Monitor alert settings per filter state
  FilterSignatureInput,// {min_market_cap, max_market_cap, ...}
} from "@/lib/types";
```

### Alert Store Functions
```typescript
import {
  generateFilterSignature,          // (filters) => SHA256 hash
  createAlertRule,                  // (rule) => Promise<AlertRule>
  getUserAlertRules,                // (userId) => Promise<AlertRule[]>
  updateAlertRule,                  // (rule) => Promise<AlertRule>
  deleteAlertRule,                  // (id) => Promise<void>
  createAlertEvent,                 // (event) => Promise<AlertEvent>
  getUserAlertEvents,               // (userId, limit) => Promise<AlertEvent[]>
  getOrCreateMonitorAlertSettings,  // (userId, filterSig) => Promise<MonitorAlertSettings>
  updateMonitorAlertSettings,       // (userId, filterSig, updates) => Promise<MonitorAlertSettings>
  checkAndUpdateCoinCooldown,       // (userId, symbol, filterSig, cooldownSec) => boolean
  checkSpikeRuleCooldown,           // (ruleId, timeframe, threshold, cooldownSec) => boolean
} from "@/lib/alertStore";
```

### Evaluator Functions
```typescript
import {
  evaluateMonitorAlerts,  // (userId, coinIds, filters, coinData) => Promise<number>
  evaluateSpikeAlerts,    // (userId) => Promise<number>
} from "@/lib/alertEvaluator";

// Example usage:
const alertsFired = await evaluateMonitorAlerts(
  "user123",
  ["bitcoin", "ethereum"],  // current filtered coin IDs
  {
    min_market_cap: 100000000,
    max_market_cap: 1000000000,
    min_volume_24h: 50000000,
    min_vol_mcap_pct: 2,
  },
  new Map([                              // coin data lookup
    ["bitcoin", { symbol: "BTC", name: "Bitcoin" }],
    ["ethereum", { symbol: "ETH", name: "Ethereum" }],
  ])
);
console.log(`${alertsFired} new coin alerts fired`);
```

### Notification Provider
```typescript
import { notificationProvider, NotificationPayload } from "@/lib/notificationProvider";

// Send notification
const delivered = await notificationProvider.send(
  "user123",
  "inApp",  // or "telegram"
  {
    type: "SPIKE",
    symbol: "BTC",
    timeframe: "1h",
    threshold: 3,
    ratio: 3.5,
    triggeredAt: new Date().toISOString(),
  }
);

// Check channel status
const isActive = await notificationProvider.getStatus("user123", "inApp");

// Get in-app notifications
const inAppProvider = notificationProvider.getInAppProvider();
const notifs = inAppProvider.getUserNotifications("user123");
```

---

## API Endpoint Reference

### Alert Rules CRUD

**GET** `/api/alerts/rules?userId=user123`
```json
Response:
{
  "rules": [
    {
      "id": "ar_1234567890_abc123",
      "user_id": "user123",
      "symbol": "BTC",
      "timeframes": ["1h", "4h"],
      "thresholds": [2, 3],
      "baseline_n": 20,
      "cooldown_seconds": 300,
      "enabled": true,
      "created_at": "2025-01-19T...",
      "updated_at": "2025-01-19T..."
    }
  ]
}
```

**POST** `/api/alerts/rules`
```json
Request:
{
  "userId": "user123",
  "symbol": "ETH",
  "timeframes": ["5m", "1h", "4h"],
  "thresholds": [2, 3],
  "baseline_n": 20,
  "cooldown_seconds": 300
}

Response:
{
  "rule": { ...AlertRule }
}
```

**PUT** `/api/alerts/rules`
```json
Request:
{
  "id": "ar_...",
  "enabled": false,
  ...otherFields
}

Response:
{
  "rule": { ...updated AlertRule }
}
```

**DELETE** `/api/alerts/rules?id=ar_...`
```json
Response:
{
  "success": true
}
```

### Alert Events

**GET** `/api/alerts/events?userId=user123&limit=50`
```json
Response:
{
  "events": [
    {
      "id": "ae_...",
      "rule_id": null,  // null for MONITOR_NEW
      "type": "MONITOR_NEW",
      "symbol": "SOL",
      "timeframe": null,
      "threshold": null,
      "ratio": null,
      "monitor_filters": {
        "min_market_cap": 100000000,
        "max_market_cap": 1000000000,
        "min_volume_24h": 50000000,
        "min_vol_mcap_pct": 2
      },
      "triggered_at": "2025-01-19T...",
      "delivered_channels": ["inApp"],
      "status": "triggered",
      "user_id": "user123"
    },
    {
      "id": "ae_...",
      "rule_id": "ar_...",
      "type": "SPIKE",
      "symbol": "BTC",
      "timeframe": "1h",
      "threshold": 3,
      "ratio": 3.24,
      "current_vol": 12500000,
      "baseline_vol": 3900000,
      "monitor_filters": null,
      "triggered_at": "2025-01-19T...",
      "delivered_channels": ["inApp"],
      "status": "triggered",
      "user_id": "user123"
    }
  ]
}
```

### Monitor Settings

**GET** `/api/alerts/monitor?userId=user123&minMarketCap=100000000&maxMarketCap=1000000000&minVolume=50000000&minVolMcapPct=2`
```json
Response:
{
  "settings": {
    "id": "mas_...",
    "user_id": "user123",
    "filter_signature": "a1b2c3d4e5f6...",
    "enabled": true,
    "cooldown_seconds": 600,
    "last_coin_ids": ["bitcoin", "ethereum", "solana"],
    "created_at": "2025-01-19T...",
    "updated_at": "2025-01-19T..."
  },
  "filterSignature": "a1b2c3d4e5f6...",
  "filters": {
    "min_market_cap": 100000000,
    "max_market_cap": 1000000000,
    "min_volume_24h": 50000000,
    "min_vol_mcap_pct": 2
  }
}
```

**PUT** `/api/alerts/monitor`
```json
Request:
{
  "userId": "user123",
  "filters": {
    "min_market_cap": 100000000,
    "max_market_cap": 1000000000,
    "min_volume_24h": 50000000,
    "min_vol_mcap_pct": 2
  },
  "enabled": true,
  "cooldown_seconds": 600
}

Response:
{
  "settings": { ...updated MonitorAlertSettings }
}
```

---

## Component Props Reference

### MonitorAlertSettingsPanel
```typescript
interface MonitorAlertSettingsPanelProps {
  userId: string;                    // User identifier
  filters: FilterSignatureInput;     // Current filter values
  onSettingsChange?: (settings: Partial<MonitorAlertSettings>) => void;
  loading?: boolean;
}

// Example:
<MonitorAlertSettingsPanel
  userId="user123"
  filters={{
    min_market_cap: 100000000,
    max_market_cap: 1000000000,
    min_volume_24h: 50000000,
    min_vol_mcap_pct: 2,
  }}
  onSettingsChange={(settings) => console.log("Updated:", settings)}
/>
```

---

## Integration Examples

### Calling Monitor Alert Evaluation After Fetch
```typescript
import { evaluateMonitorAlerts } from "@/lib/alertEvaluator";

// After fetching coins from CoinGecko:
const coinDataMap = new Map(
  coins.map(coin => [coin.id, { symbol: coin.symbol.toUpperCase(), name: coin.name }])
);

const alertsFired = await evaluateMonitorAlerts(
  userId,
  filteredCoins.map(c => c.id),
  {
    min_market_cap: filters.minMarketCap,
    max_market_cap: filters.maxMarketCap,
    min_volume_24h: filters.minVolume,
    min_vol_mcap_pct: filters.minVolumeChange,
  },
  coinDataMap
);

if (alertsFired > 0) {
  console.log(`🔔 ${alertsFired} new coin alert(s) fired!`);
}
```

### Fetching Events on Interval
```typescript
import { useEffect, useState } from "react";

const [events, setEvents] = useState([]);

useEffect(() => {
  const fetchEvents = async () => {
    const res = await fetch(`/api/alerts/events?userId=user123&limit=50`);
    const data = await res.json();
    setEvents(data.events || []);
  };

  // Initial fetch
  fetchEvents();

  // Poll every 5 seconds
  const interval = setInterval(fetchEvents, 5000);

  return () => clearInterval(interval);
}, []);
```

### Creating an Alert Rule
```typescript
const createRule = async (symbol, timeframes, thresholds) => {
  const res = await fetch("/api/alerts/rules", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: "user123",
      symbol: symbol.toUpperCase(),
      timeframes,
      thresholds,
      baseline_n: 20,
      cooldown_seconds: 300,
    }),
  });

  if (!res.ok) throw new Error("Failed to create rule");
  return res.json();
};
```

---

## Testing Examples

### Test: New Coin Detection
```typescript
import { evaluateMonitorAlerts } from "@/lib/alertEvaluator";

const filters = {
  min_market_cap: 100000000,
  max_market_cap: 1000000000,
  min_volume_24h: 50000000,
  min_vol_mcap_pct: 2,
};

const coinData = new Map([
  ["bitcoin", { symbol: "BTC", name: "Bitcoin" }],
  ["ethereum", { symbol: "ETH", name: "Ethereum" }],
]);

// Round 1: Baseline (should alert 0)
const r1 = await evaluateMonitorAlerts("user", ["bitcoin", "ethereum"], filters, coinData);
console.assert(r1 === 0, "Expected 0 alerts on first run");

// Round 2: Add new coin (should alert 1)
coinData.set("solana", { symbol: "SOL", name: "Solana" });
const r2 = await evaluateMonitorAlerts("user", ["bitcoin", "ethereum", "solana"], filters, coinData);
console.assert(r2 === 1, "Expected 1 alert for new coin SOL");

console.log("✅ Test passed");
```

---

## Debugging Tips

### Check In-App Notifications
```typescript
import { notificationProvider } from "@/lib/notificationProvider";

const provider = notificationProvider.getInAppProvider();
const userNotifs = provider.getUserNotifications("user123");
console.log("User notifications:", userNotifs);
```

### Verify Filter Signature
```typescript
import { generateFilterSignature } from "@/lib/alertStore";

const sig1 = generateFilterSignature({
  min_market_cap: 100000000,
  max_market_cap: 1000000000,
  min_volume_24h: 50000000,
  min_vol_mcap_pct: 2,
});

const sig2 = generateFilterSignature({
  min_market_cap: 50000000,  // CHANGED
  max_market_cap: 1000000000,
  min_volume_24h: 50000000,
  min_vol_mcap_pct: 2,
});

console.log("Signatures different:", sig1 !== sig2); // true
```

### Test Cooldown
```typescript
import { checkAndUpdateCoinCooldown } from "@/lib/alertStore";

const check1 = checkAndUpdateCoinCooldown("user", "BTC", "sig", 5);
console.log("First check:", check1);  // true

const check2 = checkAndUpdateCoinCooldown("user", "BTC", "sig", 5);
console.log("Immediate check:", check2);  // false (still in cooldown)
```

---

## Changelog

**v1.0 (Initial Release)**
- Monitor alerts with filter signature + per-coin cooldown
- Spike alerts with multi-timeframe, multi-threshold support
- In-app notifications
- Telegram stub (TODO)
- Full API routes
- UI components for both alert types
- Test harness
- Comprehensive documentation
