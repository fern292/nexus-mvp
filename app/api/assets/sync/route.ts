import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assetIndexer } from "@/lib/indexer";

/**
 * POST /api/assets/sync
 *
 * Trigger a manual asset sync for the current user.
 *
 * Body (optional):
 * - walletId: string — sync only a specific wallet (default: all user wallets)
 * - address: string — sync a specific address (requires walletId)
 *
 * Returns sync results per wallet, including counts of added/updated/removed assets.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Parse optional body
    let body: Record<string, unknown> = {};
    try {
      body = await request.json();
    } catch {
      // No body is fine — sync all wallets
    }

    const targetWalletId = body.walletId as string | undefined;
    const targetAddress = body.address as string | undefined;

    // Get user's wallets
    const userWallets = await prisma.wallet.findMany({
      where: { userId },
    });

    if (userWallets.length === 0) {
      return NextResponse.json(
        { error: "No wallets connected", details: "Connect a wallet first to sync assets" },
        { status: 400 }
      );
    }

    // Filter to specific wallet if requested
    let walletsToSync = userWallets;
    if (targetWalletId) {
      const found = userWallets.find((w: { id: string }) => w.id === targetWalletId);
      if (!found) {
        return NextResponse.json(
          {
            error: "Wallet not found",
            details: `Wallet ${targetWalletId} does not belong to this user`,
          },
          { status: 404 }
        );
      }
      walletsToSync = [found];
    }
    if (targetAddress) {
      const found = userWallets.find(
        (w: { id: string; address: string }) =>
          w.address.toLowerCase() === targetAddress.toLowerCase()
      );
      if (!found) {
        return NextResponse.json(
          { error: "Address not found", details: `Address ${targetAddress} is not connected` },
          { status: 404 }
        );
      }
      walletsToSync = [found];
    }

    // Check rate limiting — prevent sync more than once per 30 seconds per wallet
    const results = [];
    for (const wallet of walletsToSync) {
      if (assetIndexer.isSyncing(wallet.address)) {
        results.push({
          walletAddress: wallet.address,
          status: "skipped",
          reason: "Sync already in progress for this wallet",
          assetsAdded: 0,
          assetsUpdated: 0,
          assetsRemoved: 0,
          errors: [],
        });
        continue;
      }

      const syncResult = await assetIndexer.syncWallet(wallet.address, wallet.id, wallet.chainId);

      results.push({
        status: syncResult.errors.length > 0 ? "partial" : "success",
        ...syncResult,
      });
    }

    const totalAdded = results.reduce((sum, r) => sum + r.assetsAdded, 0);
    const totalUpdated = results.reduce((sum, r) => sum + r.assetsUpdated, 0);
    const totalRemoved = results.reduce((sum, r) => sum + r.assetsRemoved, 0);
    const allErrors = results.flatMap((r) => r.errors);

    return NextResponse.json({
      status: allErrors.length > 0 ? "partial" : "success",
      summary: {
        walletsSynced: results.length,
        totalAdded,
        totalUpdated,
        totalRemoved,
        totalErrors: allErrors.length,
      },
      results,
    });
  } catch (err) {
    console.error("[POST /api/assets/sync] Error:", err);
    return NextResponse.json(
      { error: "Sync failed", details: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
