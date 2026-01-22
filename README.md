# Altcoin Monitor

Real-time cryptocurrency monitoring with intelligent alert system. Track new coins, detect volume spikes, and get instant notifications.

## Features

### ✅ Implemented
- **Real-time Market Data**: CoinGecko API integration for live market monitoring
- **Smart Filtering**: Filter coins by market cap, volume, and custom thresholds
- **Volume Spike Detection**: Real candle data from Binance with spike analysis
- **Persistent Storage**: PostgreSQL database with Prisma ORM
- **Alert System**: 
  - Monitor new coins entering filtered criteria
  - Volume spike detection rules
  - Cooldown management to prevent alert fatigue
- **In-App Notifications**: Real-time alert display in the UI
- **Telegram Integration**: Send alerts directly to Telegram (optional, graceful degradation)
- **AI Coin Explainer**: Structured, consistent coin evaluations powered by OpenAI
  - 7-section analysis format (Scoreboard, Pros/Cons, etc.)
  - Ticker resolution against loaded universe
  - No-hype, honest assessments
- **Development Auth**: Simple header-based authentication for development

### 📊 Data Sources
- **Market Data**: CoinGecko (free tier supported)
- **OHLCV Candles**: Binance public API (no auth required)
- **Notifications**: In-app + Telegram Bot API (optional)

## Quick Start

### Local Development (No Database Required)

**1. Install Dependencies**
```bash
npm install
```

**2. Configure Environment (Optional)**
Copy `.env.example` to `.env` if you want to test with real services:
```bash
cp .env.example .env
```

**3. Build for Local Development**
```bash
npm run build:local
```
This skips database migrations and builds the app for local testing.

**4. Run Development Server**
```bash
npm run dev
```

> **Note**: Local development does NOT require PostgreSQL. The app will run with minimal setup.

---

### Production Deployment (Vercel)

**1. Set Environment Variables in Vercel**
- `DATABASE_URL` - PostgreSQL connection string (required)
- `TELEGRAM_BOT_TOKEN` - Telegram bot token (optional)
- `PUBLIC_BASE_URL` - Your Vercel deployment URL
- `OPENAI_API_KEY` - OpenAI API key for Explain tab (optional)
- `COIN_EXPLAINER_SYSTEM_PROMPT` - System prompt for AI evaluations (optional)
- `COIN_EXPLAINER_MODEL` - OpenAI model to use (optional, defaults to gpt-4o-mini)

See [VERCEL_EXPLAIN_SETUP.md](VERCEL_EXPLAIN_SETUP.md) for detailed Explain tab setup.

**2. Deploy**
Vercel will automatically run:
```bash
npm run build
```
This strict build command requires a valid PostgreSQL database and runs migrations automatically:
```bash
prisma generate && prisma migrate deploy && next build
```

> **Important**: `npm run build` will FAIL locally if PostgreSQL is not available. This is intentional. Use `npm run build:local` for local builds.

Open [http://localhost:3000](http://localhost:3000) to see the app.

## Architecture

### Frontend
- **React 19** with TypeScript
- **Tailwind CSS** for styling
- Three view modes: Table, Cards, Dense list
- Real-time market data polling
- Four tabs: Monitor, Snapshot, Alerts, Explain

### Backend
- **Next.js 16** with App Router
- **Prisma 7** with SQLite
- **REST API** for alerts management
- Dev auth via `x-user-id` header

### Database Schema
```
User
├── TelegramLink (1:1)
├── AlertRule (1:many)
├── AlertEvent (1:many)
├── MonitorAlertSettings (1:many)
├── MonitorAlertState (1:many)
```

## API Endpoints

### Alert Rules Management
- `GET /api/alerts/rules` - List rules for current user
- `POST /api/alerts/rules` - Create new alert rule
- `PUT /api/alerts/rules` - Update existing rule
- `DELETE /api/alerts/rules` - Delete rule

### Alert Events
- `GET /api/alerts/events?limit=50` - Get recent alert events

### Monitor Settings
- `GET /api/alerts/monitor` - Get current monitor settings
- `PUT /api/alerts/monitor` - Update monitor settings

### Telegram
- `POST /api/telegram/link` - Link Telegram chat ID
- `GET /api/telegram/link` - Get Telegram linking status
- `POST /api/telegram/webhook/{token}` - Webhook endpoint (receive messages)

### CoinGecko
- `GET /api/coingecko/markets` - Get filtered coin list
- `GET /api/coingecko/search` - Search for coins
- `GET /api/coingecko/market_chart_range` - Get historical price data

## Development

### Authentication
Currently uses simple header-based dev auth:
```bash
curl http://localhost:3000/api/alerts/rules \
  -H "x-user-id: demo_user"
```

Falls back to `"demo_user"` if header not provided.

### Testing Alerts
1. Create an alert rule via UI
2. System evaluates in-memory (real evaluation requires periodic monitoring)
3. Events persist to database
4. Check `/api/alerts/events` for recorded events

### Testing Telegram
1. Create a Telegram bot with @BotFather
2. Copy bot token to `.env` as `TELEGRAM_BOT_TOKEN`
3. Link your chat ID via `POST /api/telegram/link`
4. Trigger alerts to receive Telegram messages

## Build & Deploy

### Production Build
```bash
npm run build
```

### Run Production Build
```bash
npm start
```

## Environment Variables

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `DATABASE_URL` | `file:./prisma/dev.db` | ✓ | SQLite connection string |
| `TELEGRAM_BOT_TOKEN` | `` | ✗ | Telegram bot token (for alerts) |
| `PUBLIC_BASE_URL` | `http://localhost:3000` | ✗ | Base URL for webhooks |

## Troubleshooting

### Database Issues
```bash
# Reset database
rm prisma/dev.db
npx prisma migrate dev

# Generate Prisma client
npx prisma generate
```

### Build Errors
```bash
# Clear cache and rebuild
rm -r .next
npm run build
```

### Telegram Not Sending
1. Verify `TELEGRAM_BOT_TOKEN` is set in `.env`
2. Make sure bot is linked via UI
3. Check bot is active (@BotFather)
4. Review console logs for error details

### Explain Tab Issues
1. Verify `OPENAI_API_KEY` is set in `.env` or Vercel env vars
2. Check `COIN_EXPLAINER_SYSTEM_PROMPT` is configured
3. Ensure OpenAI account has available credits
4. See [VERCEL_EXPLAIN_SETUP.md](VERCEL_EXPLAIN_SETUP.md) for troubleshooting

## Known Limitations

1. **No Persistent Evaluator**: Alert rules are stored but not actively evaluated. UI allows creation for testing database layer.
2. **Development Auth Only**: No JWT/OAuth. Production would need proper auth middleware.
3. **In-Memory Evaluator State**: Spike detection uses in-memory state. Production needs DB-backed evaluator.
4. **No Trading Features**: Monitoring and alerts only. No order placement or portfolio tracking.
5. **CoinGecko Rate Limits**: Free tier is limited. Set API key for higher limits.

## Future Enhancements

- [ ] Background job for continuous alert evaluation
- [ ] WebSocket for real-time notifications
- [ ] Multiple user support with proper auth
- [ ] Email notifications
- [ ] Slack/Discord integration
- [ ] Portfolio tracking
- [ ] Price prediction using ML
- [ ] Trading signals
- [ ] Mobile app
- [ ] Explain tab: conversation memory, export history, compare coins

## Documentation

- [EXPLAIN_FEATURE.md](EXPLAIN_FEATURE.md) - AI Coin Explainer feature details
- [VERCEL_EXPLAIN_SETUP.md](VERCEL_EXPLAIN_SETUP.md) - Vercel deployment guide for Explain tab
- [ALERT_SYSTEM.md](ALERT_SYSTEM.md) - Alert system architecture
- [ALERT_QUICKSTART.md](ALERT_QUICKSTART.md) - Quick start guide for alerts
- [API_REFERENCE.md](API_REFERENCE.md) - API endpoints reference

## License

MIT

## Support

For issues or questions, open a GitHub issue.
