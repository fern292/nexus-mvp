import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { checkAllAlerts } from "@/lib/alert-checker";

/**
 * POST /api/alerts/check
 * Manually trigger alert checking for the current user.
 * In production, this would be called by a cron job every 5 minutes.
 */
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const results = await checkAllAlerts(session.user.id);
    const triggered = results.filter((r) => r.triggered);

    return NextResponse.json({
      checked: results.length,
      triggered: triggered.length,
      results: triggered,
    });
  } catch (err) {
    console.error("[POST /api/alerts/check] Error:", err);
    return NextResponse.json({ error: "Failed to check alerts" }, { status: 500 });
  }
}
