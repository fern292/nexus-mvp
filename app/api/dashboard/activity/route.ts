import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/dashboard/activity
 *
 * Returns recent activity (last N assets by lastUpdated).
 *
 * Query params:
 * - limit: number (default 20, max 50)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const { searchParams } = new URL(request.url);
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));

    const userWallets = await prisma.wallet.findMany({
      where: { userId },
      select: { id: true },
    });
    const walletIds = userWallets.map((w: { id: string }) => w.id);

    if (walletIds.length === 0) {
      return NextResponse.json({ activities: [] });
    }

    const assets = await prisma.asset.findMany({
      where: { walletId: { in: walletIds } },
      orderBy: { lastUpdated: "desc" },
      take: limit,
      select: {
        id: true,
        name: true,
        symbol: true,
        type: true,
        contract: true,
        lastUpdated: true,
        createdAt: true,
      },
    });

    const activities = assets.map((a) => ({
      id: a.id,
      assetName: a.name ?? a.symbol ?? a.contract.slice(0, 10) + "...",
      assetType: a.type,
      contract: a.contract,
      action:
        Math.abs(a.createdAt.getTime() - a.lastUpdated.getTime()) < 5000 ? "added" : "updated",
      timestamp: a.lastUpdated,
    }));

    return NextResponse.json({ activities });
  } catch (err) {
    console.error("[GET /api/dashboard/activity] Error:", err);
    return NextResponse.json(
      {
        error: "Failed to fetch activity",
        details: err instanceof Error ? err.message : "Unknown",
      },
      { status: 500 }
    );
  }
}
