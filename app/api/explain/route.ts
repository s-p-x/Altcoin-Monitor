import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/explain
 * 
 * Takes a ticker query and returns a structured coin evaluation using OpenAI.
 * 
 * Required env vars:
 * - OPENAI_API_KEY
 * - COIN_EXPLAINER_SYSTEM_PROMPT
 * 
 * Optional:
 * - COIN_EXPLAINER_MODEL (defaults to "gpt-4o-mini")
 */

const REQUIRED_SECTIONS = [
  'SCOREBOARD',
  'WHAT THE TOKEN DOES',
  'PROS',
  'CONS',
  "WHO IT'S GOOD FOR",
  "WHO IT'S NOT GOOD FOR",
  'ONE-LINE SUMMARY',
];

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export async function POST(req: NextRequest) {
  try {
    const { query, matchedCoin, messages } = await req.json();

    // Check required env vars
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    const COIN_EXPLAINER_SYSTEM_PROMPT = process.env.COIN_EXPLAINER_SYSTEM_PROMPT;
    const COIN_EXPLAINER_MODEL = process.env.COIN_EXPLAINER_MODEL || 'gpt-4o-mini';

    if (!OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'Missing OPENAI_API_KEY. Please configure it in your environment variables.' },
        { status: 500 }
      );
    }

    if (!COIN_EXPLAINER_SYSTEM_PROMPT) {
      return NextResponse.json(
        { error: 'Missing COIN_EXPLAINER_SYSTEM_PROMPT. Please configure it in your environment variables.' },
        { status: 500 }
      );
    }

    // Build context
    let contextText = `Ticker/query: ${query}\n\n`;

    if (matchedCoin) {
      contextText += `Matched Coin from Universe:\n`;
      contextText += `- ID: ${matchedCoin.id}\n`;
      contextText += `- Symbol: ${matchedCoin.symbol}\n`;
      contextText += `- Name: ${matchedCoin.name}\n`;
      contextText += `- Market Cap: $${matchedCoin.market_cap?.toLocaleString() || 'N/A'}\n`;
      contextText += `- 24h Volume: $${matchedCoin.total_volume?.toLocaleString() || 'N/A'}\n`;
      contextText += `- Current Price: $${matchedCoin.current_price || 'N/A'}\n`;
      contextText += `- CoinGecko: ${matchedCoin.coingecko_url || 'N/A'}\n\n`;
    } else {
      contextText += `Note: This ticker was not found in the current coin universe. Proceed cautiously and state what's known vs. unknown.\n\n`;
    }

    contextText += `Instruction: Respond ONLY in the required structured format with the 7 sections:\n`;
    contextText += `1) SCOREBOARD (0–10 ratings with brief notes)\n`;
    contextText += `2) WHAT THE TOKEN DOES\n`;
    contextText += `3) PROS\n`;
    contextText += `4) CONS\n`;
    contextText += `5) WHO IT'S GOOD FOR\n`;
    contextText += `6) WHO IT'S NOT GOOD FOR\n`;
    contextText += `7) ONE-LINE SUMMARY`;

    // Build messages array
    const apiMessages: Message[] = [
      { role: 'system', content: COIN_EXPLAINER_SYSTEM_PROMPT },
    ];

    // Add conversation history if present
    if (messages && Array.isArray(messages)) {
      apiMessages.push(...messages);
    }

    // Add current query
    apiMessages.push({ role: 'user', content: contextText });

    // Call OpenAI API
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: COIN_EXPLAINER_MODEL,
        messages: apiMessages,
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.json();
      console.error('OpenAI API error:', errorData);
      return NextResponse.json(
        { error: `OpenAI API error: ${errorData.error?.message || openaiResponse.statusText}` },
        { status: openaiResponse.status }
      );
    }

    const openaiData = await openaiResponse.json();
    let assistantResponse = openaiData.choices?.[0]?.message?.content || '';

    // Validate response contains all required sections
    const missingSections = REQUIRED_SECTIONS.filter(
      (section) => !assistantResponse.toUpperCase().includes(section)
    );

    // If missing sections, retry once with explicit instruction
    if (missingSections.length > 0) {
      console.warn('Missing sections, retrying with explicit instruction:', missingSections);

      const retryMessages: Message[] = [
        ...apiMessages,
        { role: 'assistant', content: assistantResponse },
        {
          role: 'user',
          content: `Your response is missing the following required sections: ${missingSections.join(
            ', '
          )}. Please rewrite strictly using ALL required headings:\n\n${REQUIRED_SECTIONS.join('\n')}`,
        },
      ];

      const retryResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: COIN_EXPLAINER_MODEL,
          messages: retryMessages,
          temperature: 0.7,
          max_tokens: 2000,
        }),
      });

      if (retryResponse.ok) {
        const retryData = await retryResponse.json();
        assistantResponse = retryData.choices?.[0]?.message?.content || assistantResponse;
      }
    }

    return NextResponse.json({ response: assistantResponse });
  } catch (error: any) {
    console.error('Explain API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
