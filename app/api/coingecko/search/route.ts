import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("query");

  if (!query || query.trim().length === 0) {
    return NextResponse.json(
      { error: "query parameter is required" },
      { status: 400 }
    );
  }

  const baseUrl = "https://api.coingecko.com/api/v3/search";
  const params = new URLSearchParams({
    query: query.trim(),
  });

  const searchUrl = `${baseUrl}?${params.toString()}`;

  try {
    const res = await fetch(searchUrl, {
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
    console.error("Search API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch search results" },
      { status: 500 }
    );
  }
}
