# Coin Explainer - System Prompt Reference

## The System Prompt

This is the exact prompt configured in `COIN_EXPLAINER_SYSTEM_PROMPT`:

```
When you send a ticker in this chat, I'm instructed to respond using a consistent, structured evaluation format rather than a casual explanation. That means I always break the coin down the same way: a scoreboard that rates the project across key dimensions (technology, tokenomics, narrative strength, adoption, liquidity, and risk), followed by clear sections explaining what the token actually does, its pros, cons, who it's good for, who it's not good for, and a one-line summary that captures the core thesis. The goal is to make every response comparable, honest, and useful—so you can quickly understand what the token is, why people care about it, where it's strong, and where the risks are, without hype or unnecessary fluff.
```

## Required Response Sections

Every AI response MUST include these 7 sections (enforced via validation):

1. **SCOREBOARD** - 0-10 ratings with brief notes for:
   - Technology
   - Tokenomics
   - Narrative Strength
   - Adoption
   - Liquidity
   - Risk

2. **WHAT THE TOKEN DOES** - Plain English, concrete utility explanation

3. **PROS** - Bullet list of strengths

4. **CONS** - Bullet list of weaknesses

5. **WHO IT'S GOOD FOR** - Bullet list of ideal users

6. **WHO IT'S NOT GOOD FOR** - Bullet list of who should avoid

7. **ONE-LINE SUMMARY** - Single sentence core thesis

## Validation Mechanism

The API route automatically validates responses:
- Checks for all 7 section headers (case-insensitive)
- If any section is missing, retries once with explicit instruction
- Ensures consistent format across all responses

## Customization

To modify the format:

1. **Update System Prompt:**
   - Edit `COIN_EXPLAINER_SYSTEM_PROMPT` in `.env` or Vercel env vars
   - Describe the new format clearly

2. **Update Required Sections:**
   - Edit `REQUIRED_SECTIONS` array in `app/api/explain/route.ts`
   - Match the section headers exactly as they should appear

3. **Redeploy:**
   - Restart dev server locally
   - Redeploy on Vercel for production

## Design Principles

### Consistency
- Same structure every time
- Makes coins easily comparable
- Reduces cognitive load

### Honesty
- No hype or marketing language
- Explicitly states unknowns
- Balanced pros/cons

### Utility
- Actionable information
- Clear audience fit
- Concrete use cases

### Brevity
- Scoreboard: brief notes, not essays
- Bullet lists: concise points
- One-line summary: single sentence only

## Example Output

```
1) SCOREBOARD (0–10 ratings with brief notes for each)
- Technology: 9/10 - Modern proof-of-stake with high throughput
- Tokenomics: 7/10 - Inflationary but predictable schedule
- Narrative Strength: 9/10 - "Ethereum killer" resonates
- Adoption: 8/10 - Growing DeFi ecosystem, major partnerships
- Liquidity: 9/10 - High volume on all major exchanges
- Risk: 6/10 - Network stability issues, centralization concerns

2) WHAT THE TOKEN DOES
Solana is a high-speed blockchain platform designed for decentralized applications and crypto-currencies, offering fast transactions (65,000 TPS) at low cost. It uses a unique proof-of-history consensus mechanism combined with proof-of-stake to achieve scalability without sharding.

3) PROS
• Extremely fast transaction speeds (sub-second finality)
• Very low transaction fees (fractions of a cent)
• Growing developer ecosystem and DeFi TVL
• Strong institutional backing and partnerships
• Active community and regular upgrades

4) CONS
• History of network outages and downtime
• Validator set is relatively centralized
• High hardware requirements for validators
• Strong competition from other L1s
• Dependence on continued VC funding

5) WHO IT'S GOOD FOR
• DeFi traders seeking low-fee, fast transactions
• NFT collectors and creators (active marketplace)
• Developers building high-throughput dApps
• Traders comfortable with higher risk for growth potential
• Those bullish on alternative L1 narratives

6) WHO IT'S NOT GOOD FOR
• Risk-averse investors prioritizing decentralization
• Those needing 100% uptime guarantees
• People skeptical of VC-heavy token distributions
• Long-term holders uncomfortable with network instability
• Ethereum maximalists

7) ONE-LINE SUMMARY
Solana is a fast, cheap blockchain betting on speed over decentralization, with strong adoption but reliability concerns.
```

## Tips for Effective Prompts

### For Users Asking Questions:
- Just enter the ticker symbol (e.g., "SOL", "ETH")
- System handles the rest automatically
- No need to ask "explain" or provide context

### For Developers Modifying:
- Keep system prompt conversational but directive
- Be explicit about format requirements
- Include tone guidelines (honest, no hype)
- Specify what to do when information is unknown

## Monitoring Quality

Watch for:
- ✅ All 7 sections present
- ✅ Scoreboard uses 0-10 scale
- ✅ Pros/cons are balanced
- ✅ Tone is neutral/analytical
- ✅ One-line summary is actually one sentence
- ❌ Sections missing (triggers retry)
- ❌ Marketing language creeping in
- ❌ Made-up facts when data unavailable
- ❌ Overly verbose responses

## Cost Optimization

Current setup (gpt-4o-mini):
- ~$0.001 per query
- ~1,000 tokens average response
- Validation retry adds ~$0.0005 if triggered

To reduce costs:
- Use even smaller model (if quality acceptable)
- Reduce max_tokens in API call
- Cache common queries (future enhancement)
- Batch requests (if implementing async)

## Security Notes

- ✅ System prompt is server-side only
- ✅ Cannot be overridden by user input
- ✅ API key never exposed to client
- ✅ User messages don't affect system behavior
- ✅ Validation prevents format manipulation
