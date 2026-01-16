import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  if (!id || !from || !to) {
    return NextResponse.json(
      { error: "id, from, and to parameters are required" },
      { status: 400 }
    );
  }

  // Validate that from and to are valid numbers (timestamps in seconds)
  const fromNum = parseInt(from, 10);
  const toNum = parseInt(to, 10);

  if (isNaN(fromNum) || isNaN(toNum)) {
    return NextResponse.json(
      { error: "from and to must be valid timestamps in seconds" },
      { status: 400 }
    );
  }

  const baseUrl = `https://api.coingecko.com/api/v3/coins/${id}/market_chart/range`;
  const params = new URLSearchParams({
    vs_currency: "usd",
    from: fromNum.toString(),
    to: toNum.toString(),
  });

  const chartUrl = `${baseUrl}?${params.toString()}`;

  try {
    const res = await fetch(chartUrl, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `CoinGecko API returned ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();

    return NextResponse.json(data, {
      status: 200,
      headers: {
        "content-type": "application/json",
      },
    });
  } catch (error) {
    console.error("Market chart range API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch market chart range" },
      { status: 500 }
    );
  }
}
