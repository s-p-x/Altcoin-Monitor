# Explain Tab - Vercel Deployment Guide

## Quick Setup

### 1. Get OpenAI API Key

1. Go to [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Sign in or create an account
3. Click "Create new secret key"
4. Copy the key (starts with `sk-...`)

### 2. Add Environment Variables to Vercel

#### Via Vercel Dashboard:

1. Go to your project on Vercel
2. Click **Settings** → **Environment Variables**
3. Add these three variables:

| Name | Value |
|------|-------|
| `OPENAI_API_KEY` | Your OpenAI API key (sk-...) |
| `COIN_EXPLAINER_SYSTEM_PROMPT` | See below |
| `COIN_EXPLAINER_MODEL` | `gpt-4o-mini` (optional) |

**COIN_EXPLAINER_SYSTEM_PROMPT value:**
```
When you send a ticker in this chat, I'm instructed to respond using a consistent, structured evaluation format rather than a casual explanation. That means I always break the coin down the same way: a scoreboard that rates the project across key dimensions (technology, tokenomics, narrative strength, adoption, liquidity, and risk), followed by clear sections explaining what the token actually does, its pros, cons, who it's good for, who it's not good for, and a one-line summary that captures the core thesis. The goal is to make every response comparable, honest, and useful—so you can quickly understand what the token is, why people care about it, where it's strong, and where the risks are, without hype or unnecessary fluff.
```

4. Click **Save** for each variable
5. **Redeploy** your app for changes to take effect

#### Via Vercel CLI:

```bash
vercel env add OPENAI_API_KEY
# Paste your key when prompted

vercel env add COIN_EXPLAINER_SYSTEM_PROMPT
# Paste the system prompt when prompted

vercel env add COIN_EXPLAINER_MODEL
# Enter: gpt-4o-mini

vercel --prod
```

### 3. Test the Feature

1. Go to your deployed app
2. Click the **Explain** tab
3. Enter a ticker like "SOL" or "ETH"
4. You should receive a structured evaluation

## Expected Response Format

Every response will follow this structure:

```
1) SCOREBOARD (0–10 ratings with brief notes for each)
- Technology: 8/10 - Modern proof-of-stake consensus
- Tokenomics: 7/10 - Inflationary but capped
- Narrative Strength: 9/10 - "Ethereum killer" narrative
- Adoption: 8/10 - Growing DeFi ecosystem
- Liquidity: 9/10 - High volume, many exchanges
- Risk: 6/10 - Network outages, competition

2) WHAT THE TOKEN DOES
Solana is a high-speed blockchain platform...

3) PROS
• Fast transaction speeds...
• Low fees...

4) CONS
• Network stability issues...
• Centralization concerns...

5) WHO IT'S GOOD FOR
• DeFi traders...
• NFT collectors...

6) WHO IT'S NOT GOOD FOR
• Risk-averse investors...
• Long-term holders...

7) ONE-LINE SUMMARY
Solana is a fast, cheap blockchain betting on speed over decentralization.
```

## Troubleshooting

### Error: "Missing OPENAI_API_KEY"

- Ensure you added the env var in Vercel settings
- Redeploy after adding variables
- Check the env var is set for Production/Preview environments

### Error: "Missing COIN_EXPLAINER_SYSTEM_PROMPT"

- Copy the exact prompt from above
- Ensure no extra quotes or formatting
- Redeploy after adding

### Response doesn't follow format

- The API automatically retries if sections are missing
- Check your model supports the system prompt (gpt-4o-mini recommended)
- Verify COIN_EXPLAINER_SYSTEM_PROMPT is set correctly

### OpenAI API errors

- Check your API key is valid
- Ensure you have credits in your OpenAI account
- Check OpenAI's status page for outages

## Cost Estimation

Using `gpt-4o-mini`:
- ~$0.15 per 1M input tokens
- ~$0.60 per 1M output tokens
- Average response: ~1,000 tokens
- **Cost per query: ~$0.001** (less than a penny)

100 queries per day ≈ $3/month

## Customization

To modify the evaluation format:

1. Update `COIN_EXPLAINER_SYSTEM_PROMPT` in Vercel env vars
2. Update `REQUIRED_SECTIONS` in [app/api/explain/route.ts](../app/api/explain/route.ts) if you change section headings
3. Redeploy

## Security Notes

- ✅ API keys are server-only (never sent to client)
- ✅ No secrets in logs
- ✅ Vercel environment variables are encrypted
- ❌ Do NOT commit your `.env` file to git
- ❌ Do NOT share your OpenAI API key publicly

## Support

For issues specific to:
- **OpenAI API**: [https://help.openai.com](https://help.openai.com)
- **Vercel deployment**: [https://vercel.com/docs](https://vercel.com/docs)
- **This app**: Check [EXPLAIN_FEATURE.md](../EXPLAIN_FEATURE.md)
