import { NextResponse, NextRequest } from "next/server";
import { getUserAlertEvents } from "@/lib/dbRepository";

/**
 * Get user ID from request (dev auth)
 */
function getUserId(req: NextRequest): string {
  return req.headers.get("x-user-id") || "demo_user";
}

/**
 * GET /api/alerts/events
 * Get alert events for current user (paginated, newest first)
 */
export async function GET(request: NextRequest) {
  try {
    const userId = getUserId(request);
    const limit = parseInt(request.nextUrl.searchParams.get("limit") || "50", 10);

    const events = await getUserAlertEvents(userId, Math.min(limit, 500));
    return NextResponse.json({ events });
  } catch (error: any) {
    console.error("[GET /api/alerts/events] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch events" },
      { status: 500 }
    );
  }
}
