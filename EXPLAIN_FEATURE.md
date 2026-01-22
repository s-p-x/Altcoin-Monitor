# Coin Explainer Feature

## Overview

The **Explain** tab provides an AI-powered chatbot that delivers structured, consistent coin evaluations. When a user enters a ticker symbol, the chatbot responds with a comprehensive analysis following a strict 7-section format.

## Features

### 1. **Structured Evaluation Format**
Every response follows this template:

1. **SCOREBOARD** - 0-10 ratings with brief notes for:
   - Technology
   - Tokenomics
   - Narrative Strength
   - Adoption
   - Liquidity
   - Risk

2. **WHAT THE TOKEN DOES** - Plain English explanation of concrete utility

3. **PROS** - Bullet list of strengths

4. **CONS** - Bullet list of weaknesses

5. **WHO IT'S GOOD FOR** - Bullet list of ideal user profiles

6. **WHO IT'S NOT GOOD FOR** - Bullet list of users who should avoid

7. **ONE-LINE SUMMARY** - Single sentence core thesis

### 2. **Ticker Resolution**
- Automatically matches user input against the loaded coin universe
- Exact symbol match (case-insensitive) preferred
- Fallback to name contains query
- Passes coin metadata (market cap, volume, price, etc.) to AI for context

### 3. **Honest, No-Hype Analysis**
- System prompt enforces factual, comparable responses
- Explicitly states what's unknown rather than inventing facts
- No marketing language or unnecessary fluff

## Implementation

### Components

#### **ExplainTab Component**
[app/components/ExplainTab.tsx](app/components/ExplainTab.tsx)
- Chat UI with message history
- Ticker input and send button
- Auto-scrolling messages
- Error handling and loading states
- Matches tickers against universe coins

#### **API Route**
[app/api/explain/route.ts](app/api/explain/route.ts)
- Server-only OpenAI integration
- System prompt from env variable
- 7-section format validation with automatic retry
- Secure key handling (no client exposure)

#### **Type Definitions**
[lib/types.ts](lib/types.ts)
- ExplainMessage, MatchedCoin, ExplainRequest, ExplainResponse

### Environment Variables

Required in `.env` and Vercel environment:

```bash
# Required: Your OpenAI API key
OPENAI_API_KEY="sk-..."

# Required: System prompt that enforces the structured format
COIN_EXPLAINER_SYSTEM_PROMPT="When you send a ticker in this chat, I'm instructed to respond using a consistent, structured evaluation format rather than a casual explanation. That means I always break the coin down the same way: a scoreboard that rates the project across key dimensions (technology, tokenomics, narrative strength, adoption, liquidity, and risk), followed by clear sections explaining what the token actually does, its pros, cons, who it's good for, who it's not good for, and a one-line summary that captures the core thesis. The goal is to make every response comparable, honest, and useful—so you can quickly understand what the token is, why people care about it, where it's strong, and where the risks are, without hype or unnecessary fluff."

# Optional: Defaults to gpt-4o-mini if not set
COIN_EXPLAINER_MODEL="gpt-4o-mini"
```

### UI Integration

The Explain tab is added to [app/AltcoinMonitor.tsx](app/AltcoinMonitor.tsx):
- New tab button with ✨ icon
- Tab state persisted to localStorage
- Passes universeCoins to ExplainTab for ticker matching

## Usage

### Local Development

1. Add your OpenAI API key to `.env`:
   ```bash
   OPENAI_API_KEY="sk-..."
   ```

2. The system prompt is already configured in `.env`

3. Start the dev server:
   ```bash
   npm run dev
   ```

4. Navigate to the **Explain** tab

5. Enter a ticker (e.g., "SOL", "ETH", "PEPE")

6. Receive structured evaluation

### Vercel Deployment

Add these environment variables to your Vercel project:

1. Go to Project Settings → Environment Variables
2. Add:
   - `OPENAI_API_KEY` (your OpenAI key)
   - `COIN_EXPLAINER_SYSTEM_PROMPT` (copy from .env)
   - `COIN_EXPLAINER_MODEL` (optional, defaults to gpt-4o-mini)

## Security

- ✅ API keys only in server environment
- ✅ No secrets logged
- ✅ Clear error messages if env vars missing
- ✅ Server-side validation
- ✅ No direct client access to OpenAI

## Format Validation

The API route validates that responses contain all 7 required sections:
- If any section is missing, it automatically retries once
- Retry explicitly asks the model to include all required headings
- Ensures consistency across all responses

## Error Handling

- Missing API key: Returns clear 500 with "Missing OPENAI_API_KEY"
- Missing system prompt: Returns clear 500 with "Missing COIN_EXPLAINER_SYSTEM_PROMPT"
- OpenAI API errors: Returns error message with status code
- Network errors: Displays in UI with retry option

## Customization

To modify the evaluation format:

1. Update `COIN_EXPLAINER_SYSTEM_PROMPT` in `.env`
2. Update `REQUIRED_SECTIONS` array in [app/api/explain/route.ts](app/api/explain/route.ts)
3. Redeploy or restart dev server

## Future Enhancements

Potential improvements:
- [ ] Conversation memory/context
- [ ] Export chat history
- [ ] Compare multiple coins side-by-side
- [ ] Voice input for tickers
- [ ] Save favorite analyses
- [ ] Share analysis links
