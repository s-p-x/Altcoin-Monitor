# Vercel Deployment Guide

## Environment Variables Required

Add these to your Vercel project settings under **Settings > Environment Variables**:

### Required
```
DATABASE_URL=file:./prisma/dev.db
```

### Optional (for Telegram notifications)
```
TELEGRAM_BOT_TOKEN=your_bot_token_here
PUBLIC_BASE_URL=https://your-project.vercel.app
```

## Deployment Checklist

- [ ] Add `DATABASE_URL` to Vercel environment variables
- [ ] Run `npm run build` locally to verify no errors
- [ ] Push to GitHub - Vercel will auto-deploy
- [ ] Check Vercel deployment logs for errors
- [ ] Test API endpoints on deployed site
- [ ] If using Telegram, configure bot token in Vercel env vars

## SQLite Limitations on Vercel

⚠️ **Important**: SQLite database files are not persisted on Vercel's ephemeral filesystem.

For production use, consider migrating to:
- PostgreSQL (recommended)
- MongoDB
- MySQL
- Railway, Render, or Supabase for managed databases

For development/testing, the current SQLite setup works fine.

## Troubleshooting Build Failures

### "npm run build failed"
1. Check that `DATABASE_URL` is set in environment variables
2. Ensure all imports of PrismaClient use `getPrismaClient()` function
3. Run `npm run build` locally to test before pushing

### API returning 500 errors
1. Check Vercel function logs
2. Verify DATABASE_URL is accessible
3. Check that Prisma migrations are up to date: `npx prisma migrate deploy`

## Useful Commands

```bash
# Test build locally
npm run build

# Generate Prisma client
npx prisma generate

# Apply migrations
npx prisma migrate deploy

# View database
npx prisma studio
```
