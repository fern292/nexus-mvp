import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/dashboard/summary
 *
 * Returns portfolio summary:
 * - totalAssets: number
 * - nftCount: number
 * - tokenCount: number
 * - walletCount: number
 * - lastSyncAt: Date | null
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    const userWallets = await prisma.wallet.findMany({
      where: { userId },
      select: { id: true },
    });
    const walletIds = userWallets.map((w) => w.id);

    if (walletIds.length === 0) {
      return NextResponse.json({
        totalAssets: 0,
        nftCount: 0,
        tokenCount: 0,
        walletCount: 0,
        lastSyncAt: null,
      });
    }

    const walletCount = walletIds.length;

    const [totalAssets, nftCount, tokenCount, lastSync] = await Promise.all([
      prisma.asset.count({ where: { walletId: { in: walletIds } } }),
      prisma.asset.count({ where: { walletId: { in: walletIds }, type: "NFT" } }),
      prisma.asset.count({ where: { walletId: { in: walletIds }, type: "TOKEN" } }),
      prisma.asset.findFirst({
        where: { walletId: { in: walletIds } },
        orderBy: { lastUpdated: "desc" },
        select: { lastUpdated: true },
      }),
    ]);

    return NextResponse.json({
      totalAssets,
      nftCount,
      tokenCount,
      walletCount,
      lastSyncAt: lastSync?.lastUpdated ?? null,
    });
  } catch (err) {
    console.error("[GET /api/dashboard/summary] Error:", err);
    return NextResponse.json(
      { error: "Failed to fetch summary", details: err instanceof Error ? err.message : "Unknown" },
      { status: 500 }
    );
  }
}
