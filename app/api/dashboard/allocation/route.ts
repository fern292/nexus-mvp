import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/dashboard/allocation
 *
 * Returns allocation data for charts:
 * - byType: [{ name, count }]
 * - byChain: [{ name, count }]
 * - byContract: [{ name, count }] (top 10 collections)
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
    const walletIds = userWallets.map((w: { id: string }) => w.id);

    if (walletIds.length === 0) {
      return NextResponse.json({ byType: [], byChain: [], byContract: [] });
    }

    const assets = await prisma.asset.findMany({
      where: { walletId: { in: walletIds } },
      select: { type: true, chainId: true, contract: true },
    });

    // Allocation by type
    const typeMap = new Map<string, number>();
    for (const a of assets) {
      typeMap.set(a.type, (typeMap.get(a.type) ?? 0) + 1);
    }
    const byType = Array.from(typeMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    // Allocation by chain
    const chainMap = new Map<string, number>();
    for (const a of assets) {
      const key = `Chain ${a.chainId}`;
      chainMap.set(key, (chainMap.get(key) ?? 0) + 1);
    }
    const byChain = Array.from(chainMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    // Allocation by contract (top 10)
    const contractMap = new Map<string, number>();
    for (const a of assets) {
      contractMap.set(a.contract, (contractMap.get(a.contract) ?? 0) + 1);
    }
    const byContract = Array.from(contractMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return NextResponse.json({ byType, byChain, byContract });
  } catch (err) {
    console.error("[GET /api/dashboard/allocation] Error:", err);
    return NextResponse.json(
      {
        error: "Failed to fetch allocation",
        details: err instanceof Error ? err.message : "Unknown",
      },
      { status: 500 }
    );
  }
}
