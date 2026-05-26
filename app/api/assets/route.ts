import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assetIndexer } from "@/lib/indexer";

/**
 * GET /api/assets
 *
 * List all assets for the current user's connected wallets.
 *
 * Query params:
 * - type: "TOKEN" | "NFT" — filter by asset type
 * - walletId: string — filter by specific wallet
 * - chainId: number — filter by chain
 * - search: string — filter by name/symbol (case-insensitive)
 * - sort: string — sort field (name, balance, lastUpdated, createdAt)
 * - order: "asc" | "desc" — sort direction
 * - page: number — pagination page (default 1)
 * - limit: number — items per page (default 50, max 100)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const { searchParams } = new URL(request.url);

    // Build filter
    const where: Record<string, unknown> = {};

    // Must belong to user's wallets
    const userWallets = await prisma.wallet.findMany({
      where: { userId },
      select: { id: true },
    });
    const walletIds = userWallets.map((w: { id: string }) => w.id);
    where.walletId = { in: walletIds };

    // Optional filters
    const type = searchParams.get("type");
    if (type === "TOKEN" || type === "NFT") {
      where.type = type;
    }

    const walletId = searchParams.get("walletId");
    if (walletId && walletIds.includes(walletId)) {
      where.walletId = walletId;
    }

    const chainId = searchParams.get("chainId");
    if (chainId) {
      where.chainId = parseInt(chainId, 10);
    }

    const search = searchParams.get("search");
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { symbol: { contains: search, mode: "insensitive" } },
        { contract: { contains: search, mode: "insensitive" } },
      ];
    }

    // Pagination
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));
    const skip = (page - 1) * limit;

    // Sorting
    const sortField = searchParams.get("sort") || "lastUpdated";
    const sortOrder = searchParams.get("order") === "asc" ? "asc" : "desc";
    const allowedSortFields = ["name", "balance", "lastUpdated", "createdAt", "type"];
    const orderBy: Record<string, string> = {};
    orderBy[allowedSortFields.includes(sortField) ? sortField : "lastUpdated"] = sortOrder;

    // Fetch
    const [assets, total] = await Promise.all([
      prisma.asset.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          wallet: {
            select: { address: true, chainId: true },
          },
        },
      }),
      prisma.asset.count({ where }),
    ]);

    return NextResponse.json({
      data: assets,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("[GET /api/assets] Error:", err);
    return NextResponse.json(
      {
        error: "Failed to fetch assets",
        details: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
