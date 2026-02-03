# Telegram Linking - Quick Reference

## 🚀 Quick Setup

### 1. Environment Variables
```bash
TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather
TELEGRAM_WEBHOOK_SECRET=random_32_char_secret
```

### 2. Run Migration
```bash
npx prisma migrate dev
```

### 3. Set Webhook
```bash
BOT_TOKEN="your_token"
WEBHOOK_SECRET="your_secret"
BASE_URL="https://your-app.vercel.app"

curl -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{\"url\":\"${BASE_URL}/api/telegram/webhook\",\"secret_token\":\"${WEBHOOK_SECRET}\"}"
```

---

## 📋 How It Works

### User Flow
1. User calls `POST /api/telegram/link` → Gets 6-digit code
2. User sends `/link 123456` to bot in Telegram
3. Bot verifies code and links `chatId` to user account
4. Alerts now arrive in Telegram DMs

---

## 🔧 API Endpoints

### Generate Link Code
```bash
curl -X POST http://localhost:3000/api/telegram/link \
  -H "x-user-id: demo_user"
```

**Response:**
```json
{"code":"123456","expiresAt":"2026-02-03T13:00:00Z","expiresInSeconds":600}
```

### Health Check
```bash
curl http://localhost:3000/api/telegram/webhook
```

---

## 🤖 Bot Commands

| Command | Description |
|---------|-------------|
| `/start` | Welcome message |
| `/link 123456` | Link account with code |
| `/status` | Check connection |
| `/help` | Show all commands |

---

## 🛠️ Testing Flow

### Local Development (ngrok required)

```bash
# 1. Start dev server
npm run dev

# 2. Start ngrok
ngrok http 3000

# 3. Set webhook to ngrok URL
curl -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  -d "url=https://abc123.ngrok.io/api/telegram/webhook" \
  -d "secret_token=dev_secret"

# 4. Generate code
curl -X POST http://localhost:3000/api/telegram/link \
  -H "x-user-id: demo_user"

# 5. In Telegram, send:
/start
/link 123456

# 6. Verify in DB
SELECT * FROM "TelegramLink" WHERE "userId" = 'demo_user';
```

---

## 🐛 Common Issues

### "Invalid code"
→ Code expired (10 min limit). Generate new code.

### Bot not responding
→ Check webhook: `curl https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`

### "Unauthorized" webhook error
→ Verify `TELEGRAM_WEBHOOK_SECRET` matches in env vars and setWebhook call

### Alerts not arriving
→ Check `SELECT * FROM "TelegramLink"` - must have `chatId` and `enabled=true`

---

## 📊 Database Schema

```sql
-- TelegramLink table
userId              TEXT    UNIQUE (FK to User)
chatId              TEXT    NULL (Telegram chat ID)
enabled             BOOLEAN DEFAULT false
linkCode            TEXT    NULL (6-digit code)
linkCodeExpiresAt   TIMESTAMP NULL (expires in 10 min)
```

---

## 🔐 Security

✅ Webhook secret validation  
✅ Code expiration (10 minutes)  
✅ One-time use codes  
✅ User authentication required  

---

## 📁 Files

| File | Purpose |
|------|---------|
| `app/api/telegram/link/route.ts` | Generate link code |
| `app/api/telegram/webhook/route.ts` | Handle bot commands |
| `lib/dbRepository.ts` | `generateTelegramLinkCode()`, `verifyAndLinkTelegramCode()` |
| `prisma/migrations/.../migration.sql` | Add linkCode fields |

---

## 🔗 Full Documentation

See [TELEGRAM_LINKING_SETUP.md](TELEGRAM_LINKING_SETUP.md) for complete setup guide.
