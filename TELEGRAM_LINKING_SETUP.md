# Telegram Linking - Setup Guide

## Overview

Users can now securely link their Telegram account to receive alerts via DM using a 6-digit code.

---

## Environment Variables

Add these to your `.env` file or Vercel environment variables:

```bash
# Required - Your Telegram bot token from @BotFather
TELEGRAM_BOT_TOKEN=your_bot_token_here

# Recommended - Secret for webhook security
TELEGRAM_WEBHOOK_SECRET=your_random_secret_here
```

### How to Get TELEGRAM_BOT_TOKEN

1. Open Telegram and search for [@BotFather](https://t.me/BotFather)
2. Send `/newbot` command
3. Follow prompts to set name and username
4. Copy the token (looks like `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`)
5. Add to environment variables

### How to Generate TELEGRAM_WEBHOOK_SECRET

```bash
# Linux/Mac
openssl rand -hex 32

# PowerShell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

---

## Database Migration

Run the migration to add link code fields:

```bash
# Development
npx prisma migrate dev

# Production (Vercel auto-runs on deploy)
npx prisma migrate deploy
```

**Migration file:** `prisma/migrations/20260203124014_add_telegram_link_code/migration.sql`

**Changes:**
- Added `linkCode` (nullable string) - 6-digit code
- Added `linkCodeExpiresAt` (nullable datetime) - expiration timestamp

---

## Setting Up the Webhook

### Option 1: Using curl (Recommended)

```bash
# Set your values
BOT_TOKEN="your_telegram_bot_token"
WEBHOOK_SECRET="your_webhook_secret"
BASE_URL="https://your-app.vercel.app"  # or http://localhost:3000 for dev

# Set webhook with secret token
curl -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{
    \"url\": \"${BASE_URL}/api/telegram/webhook\",
    \"secret_token\": \"${WEBHOOK_SECRET}\",
    \"allowed_updates\": [\"message\"]
  }"
```

**Expected response:**
```json
{"ok":true,"result":true,"description":"Webhook was set"}
```

### Option 2: Using Telegram API directly

Visit this URL in your browser (replace `YOUR_BOT_TOKEN` and `YOUR_APP_URL`):

```
https://api.telegram.org/botYOUR_BOT_TOKEN/setWebhook?url=YOUR_APP_URL/api/telegram/webhook&secret_token=YOUR_SECRET
```

### Verify Webhook Setup

```bash
curl "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo"
```

**Expected response:**
```json
{
  "ok": true,
  "result": {
    "url": "https://your-app.vercel.app/api/telegram/webhook",
    "has_custom_certificate": false,
    "pending_update_count": 0
  }
}
```

---

## How It Works

### User Flow

1. **User requests link code**
   - Frontend calls: `POST /api/telegram/link`
   - Returns 6-digit code (e.g., "123456")
   - Code expires in 10 minutes

2. **User sends code to Telegram bot**
   - User sends: `/link 123456` to bot in Telegram
   - Bot verifies code and links `chatId` to user account

3. **Alerts are delivered**
   - When alerts fire, notifications are sent to linked Telegram chat

### API Endpoints

#### `POST /api/telegram/link`
**Purpose:** Generate a link code

**Headers:**
```
x-user-id: demo_user
```

**Response:**
```json
{
  "success": true,
  "code": "123456",
  "expiresAt": "2026-02-03T12:50:14.000Z",
  "expiresInSeconds": 600,
  "instructions": "Send '/link 123456' to the bot in Telegram"
}
```

#### `POST /api/telegram/webhook`
**Purpose:** Receive Telegram updates (bot commands)

**Security:** Validates `x-telegram-bot-api-secret-token` header

**Supported Commands:**
- `/start` - Welcome message with instructions
- `/link CODE` - Link account with 6-digit code
- `/status` - Check bot connection
- `/help` - List all commands

---

## Testing Locally

### 1. Start Development Server

```bash
npm run dev
```

### 2. Expose Local Server (ngrok or similar)

Telegram webhooks require HTTPS. Use ngrok:

```bash
# Install ngrok: https://ngrok.com/download
ngrok http 3000
```

Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)

### 3. Set Webhook to ngrok URL

```bash
BOT_TOKEN="your_bot_token"
WEBHOOK_SECRET="dev_secret_123"

curl -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{
    \"url\": \"https://abc123.ngrok.io/api/telegram/webhook\",
    \"secret_token\": \"${WEBHOOK_SECRET}\"
  }"
```

### 4. Test Link Flow

**A. Generate link code:**
```bash
curl -X POST http://localhost:3000/api/telegram/link \
  -H "x-user-id: demo_user"
```

**Response:**
```json
{
  "code": "847392",
  "expiresAt": "2026-02-03T13:00:00.000Z"
}
```

**B. Link in Telegram:**
1. Open your bot in Telegram
2. Send: `/start`
3. Send: `/link 847392`
4. Bot responds: "✅ Account linked successfully!"

**C. Verify link:**
```sql
SELECT * FROM "TelegramLink" WHERE "userId" = 'demo_user';
```

---

## Production Deployment (Vercel)

### 1. Add Environment Variables

Vercel Dashboard → Settings → Environment Variables:

| Name | Value | Environments |
|------|-------|--------------|
| `TELEGRAM_BOT_TOKEN` | Your bot token | ✓ Production, ✓ Preview |
| `TELEGRAM_WEBHOOK_SECRET` | Random secret | ✓ Production, ✓ Preview |

### 2. Deploy

```bash
git add .
git commit -m "Add Telegram linking with secure codes"
git push
```

### 3. Set Webhook to Production URL

```bash
BOT_TOKEN="your_production_bot_token"
WEBHOOK_SECRET="your_production_secret"
BASE_URL="https://your-app.vercel.app"

curl -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{
    \"url\": \"${BASE_URL}/api/telegram/webhook\",
    \"secret_token\": \"${WEBHOOK_SECRET}\"
  }"
```

### 4. Test End-to-End

1. Go to your app → Alerts tab
2. *(Future: Add UI to request link code)*
3. Or call API manually:
   ```bash
   curl -X POST https://your-app.vercel.app/api/telegram/link \
     -H "x-user-id: your_user_id"
   ```
4. Send `/link CODE` to bot in Telegram
5. Create an alert rule and wait for it to fire
6. Alert appears in Telegram DM

---

## Security Features

### ✅ Implemented

1. **Webhook Secret Verification**
   - Telegram includes `x-telegram-bot-api-secret-token` header
   - Server validates against `TELEGRAM_WEBHOOK_SECRET`
   - Rejects unauthorized requests

2. **Code Expiration**
   - Link codes expire after 10 minutes
   - Old codes are automatically rejected

3. **One-Time Use Codes**
   - Code is cleared after successful link
   - Cannot be reused

4. **User Authentication**
   - Link code generation requires authenticated user (x-user-id header)
   - Only authenticated user can generate their own code

### 🔒 Best Practices

✅ **DO:**
- Use HTTPS in production (Vercel provides this)
- Keep `TELEGRAM_BOT_TOKEN` secret
- Rotate `TELEGRAM_WEBHOOK_SECRET` periodically
- Set webhook URL to your production domain only

❌ **DON'T:**
- Commit `.env` to git
- Share bot token publicly
- Use HTTP for webhooks (Telegram requires HTTPS)
- Reuse old link codes

---

## Troubleshooting

### Bot not responding to commands

**Check 1: Webhook is set correctly**
```bash
curl "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo"
```

Should show your app URL.

**Check 2: Webhook secret matches**
- `TELEGRAM_WEBHOOK_SECRET` in env vars
- Must match secret sent in `setWebhook` call

**Check 3: Logs show incoming requests**
- Vercel: Deployments → Functions → `/api/telegram/webhook`
- Look for `[Telegram Webhook]` logs

---

### "Invalid code" error when linking

**Check 1: Code hasn't expired**
- Codes expire after 10 minutes
- Generate a new code and try immediately

**Check 2: Code exists in database**
```sql
SELECT * FROM "TelegramLink" WHERE "linkCode" = '123456';
```

**Check 3: Check code format**
- Must be exactly 6 digits
- Send: `/link 123456` (not `/link123456`)

---

### Alerts not arriving in Telegram

**Check 1: Account is linked**
```sql
SELECT * FROM "TelegramLink" WHERE "userId" = 'demo_user';
```

Should have `chatId` and `enabled = true`.

**Check 2: Alert fired**
```sql
SELECT * FROM "AlertEvent" 
WHERE "userId" = 'demo_user' 
ORDER BY "triggeredAt" DESC 
LIMIT 1;
```

Check `deliveredChannelsJson` includes `"telegram"`.

**Check 3: Bot token is valid**
```bash
curl "https://api.telegram.org/bot${BOT_TOKEN}/getMe"
```

Should return bot info.

---

## API Reference

### POST /api/telegram/link

**Purpose:** Generate a 6-digit link code for the authenticated user

**Request:**
```bash
curl -X POST http://localhost:3000/api/telegram/link \
  -H "x-user-id: demo_user"
```

**Response (200):**
```json
{
  "success": true,
  "code": "847392",
  "expiresAt": "2026-02-03T13:00:14.000Z",
  "expiresInSeconds": 600,
  "instructions": "Send '/link 847392' to the bot in Telegram"
}
```

**Response (500):**
```json
{
  "error": "Failed to generate link code"
}
```

---

### POST /api/telegram/webhook

**Purpose:** Receive Telegram bot updates

**Security:** Validates `x-telegram-bot-api-secret-token` header

**Request (from Telegram):**
```json
{
  "update_id": 123456,
  "message": {
    "message_id": 789,
    "from": {
      "id": 987654321,
      "first_name": "John"
    },
    "chat": {
      "id": 987654321
    },
    "text": "/link 847392"
  }
}
```

**Response (200):**
```json
{
  "ok": true
}
```

**Bot Reply (on successful link):**
```
✅ Account linked successfully!

You'll now receive alert notifications here.

Commands:
/status - Check connection
/help - Show all commands
```

---

### GET /api/telegram/webhook

**Purpose:** Health check

**Request:**
```bash
curl http://localhost:3000/api/telegram/webhook
```

**Response:**
```json
{
  "configured": true,
  "secured": true,
  "message": "Telegram webhook endpoint is active"
}
```

---

## Command Reference

| Command | Description | Example |
|---------|-------------|---------|
| `/start` | Welcome message with instructions | `/start` |
| `/link CODE` | Link account with 6-digit code | `/link 123456` |
| `/status` | Check bot connection status | `/status` |
| `/help` | Show all available commands | `/help` |

---

## Files Modified/Created

### Modified
- `prisma/schema.prisma` - Added `linkCode`, `linkCodeExpiresAt` to TelegramLink
- `app/api/telegram/link/route.ts` - Generate link code endpoint
- `app/api/telegram/webhook/route.ts` - Handle /start and /link commands
- `lib/dbRepository.ts` - Added `generateTelegramLinkCode()`, `verifyAndLinkTelegramCode()`

### Created
- `prisma/migrations/20260203124014_add_telegram_link_code/migration.sql` - Migration
- `TELEGRAM_LINKING_SETUP.md` - This file

---

## Next Steps (Future UI Work)

### Add to Alerts Tab

```tsx
// In app/components/Alerts.tsx or new TelegramSettings.tsx

const [linkCode, setLinkCode] = useState<string | null>(null);

const generateLinkCode = async () => {
  const res = await fetch('/api/telegram/link', {
    method: 'POST',
    headers: { 'x-user-id': 'demo_user' }
  });
  const data = await res.json();
  setLinkCode(data.code);
};

return (
  <button onClick={generateLinkCode}>
    Link Telegram
  </button>
  {linkCode && (
    <p>Send this to your bot: /link {linkCode}</p>
  )}
);
```

---

## Cost & Performance

**Telegram API:**
- Free for bots
- No rate limits for most use cases
- Webhooks are more efficient than polling

**Database:**
- 1 additional table row per user (TelegramLink)
- Minimal storage (~100 bytes per user)

**Network:**
- Webhook receives 1 request per user message
- Alert notifications: 1 outbound request per alert per user

---

## Support & Resources

- **Telegram Bot API Docs:** https://core.telegram.org/bots/api
- **Webhook Guide:** https://core.telegram.org/bots/webhooks
- **BotFather Commands:** https://core.telegram.org/bots#6-botfather

---

**Telegram linking is now fully functional! 🎉**

Users can securely link their account with a 6-digit code and receive alerts in Telegram DMs.
