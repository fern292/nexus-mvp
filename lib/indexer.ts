import { prisma } from "@/lib/prisma";
import { EnjinClient, enjin } from "@/lib/enjin";
import type { EnjinToken } from "@/types/asset";
import type { AssetType } from "@/types/asset";
import type { SyncResult } from "@/types/asset";

const SYNC_INTERVAL_MS = 60_000; // 60 seconds

/**
 * Determine if an NFT or fungible token based on token properties.
 *
 * Enjin NFTs typically:
 * - Have a specific tokenId (non-fungible)
 * - Have totalSupply of 1 or limited edition
 * - Have metadata/attributes
 *
 * Fungible tokens:
 * - May not have a unique tokenId
 * - Have higher totalSupply
 */
function determineTokenType(token: EnjinToken): AssetType {
  // If it has attributes or specific media, likely an NFT
  if (token.attributes && token.attributes.length > 0) {
    return "NFT";
  }

  // If totalSupply is 1 or very limited, likely an NFT
  if (token.totalSupply) {
    const supply = BigInt(token.totalSupply);
    if (supply <= BigInt(1)) {
      return "NFT";
    }
    // If supply is small (≤ 100) and has unique tokenId, could be NFT
    if (supply <= BigInt(100) && token.tokenId) {
      return "NFT";
    }
  }

  // If it has media and a unique tokenId, likely NFT
  if (token.media?.url && token.tokenId) {
    return "NFT";
  }

  // Default to TOKEN for fungible assets
  return "TOKEN";
}

/**
 * Normalize an Enjin token into the database Asset format.
 */
function normalizeToken(
  token: EnjinToken,
  walletId: string,
  chainId: number,
  gameName?: string | null
) {
  const type = determineTokenType(token);
  const metadata = EnjinClient.parseMetadata(token);
  const rarity = EnjinClient.extractRarity(token);

  return {
    tokenId: token.tokenId ?? null,
    contract: token.collectionId ?? token.id,
    name: token.name,
    symbol: token.symbol,
    decimals: token.decimals ?? 18,
    balance: token.balance ?? "0",
    type,
    chainId,
    walletId,
    metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    lastUpdated: new Date(),
  };
}

/**
 * Indexer service for detecting and tracking Enjin NFTs and tokens.
 *
 * This service:
 * 1. Fetches all assets for connected wallet addresses from Enjin Platform
 * 2. Normalizes the data into our Asset type
 * 3. Stores/updates assets in PostgreSQL via Prisma
 * 4. Supports periodic polling and manual sync triggers
 */
export class AssetIndexer {
  private client: EnjinClient;
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private syncing: Set<string> = new Set();

  constructor(client?: EnjinClient) {
    this.client = client ?? enjin;
  }

  /**
   * Sync assets for a single wallet address.
   * Fetches all tokens from Enjin and upserts them in the database.
   */
  async syncWallet(
    walletAddress: string,
    walletId: string,
    chainId: number = 1
  ): Promise<SyncResult> {
    const result: SyncResult = {
      walletAddress,
      assetsAdded: 0,
      assetsUpdated: 0,
      assetsRemoved: 0,
      errors: [],
      syncedAt: new Date(),
    };

    // Prevent concurrent syncs for the same wallet
    if (this.syncing.has(walletAddress)) {
      result.errors.push("Sync already in progress for this wallet");
      return result;
    }

    this.syncing.add(walletAddress);

    try {
      // Fetch all tokens from Enjin
      const tokens = await this.client.getAllWalletTokens(walletAddress);

      if (tokens.length === 0) {
        // No tokens found — remove any stale assets for this wallet
        const deleted = await prisma.asset.deleteMany({
          where: { walletId },
        });
        result.assetsRemoved = deleted.count;
        return result;
      }

      // Get collection info for game name extraction (use first collection)
      const collectionIds = tokens
        .map((t) => t.collectionId)
        .filter((id): id is string => id !== null && id !== undefined);
      // Deduplicate collection IDs manually
      const uniqueCollectionIds: string[] = [];
      const seenCollectionIds: Record<string, boolean> = {};
      for (const id of collectionIds) {
        if (!seenCollectionIds[id]) {
          seenCollectionIds[id] = true;
          uniqueCollectionIds.push(id);
        }
      }
      const collectionsMap = new Map<string, string | null>();

      for (const colId of uniqueCollectionIds.slice(0, 5)) {
        try {
          const col = await this.client.getCollection(colId);
          collectionsMap.set(colId, col?.name ?? null);
        } catch {
          // Ignore collection fetch errors
        }
      }

      // Get existing assets for this wallet
      const existingAssets = await prisma.asset.findMany({
        where: { walletId },
      });
      const existingIds = new Set(existingAssets.map((a) => a.tokenId ?? a.contract));

      // Track which tokens we've processed
      const processedIds = new Set<string>();

      for (const token of tokens) {
        try {
          const normalized = normalizeToken(
            token,
            walletId,
            chainId,
            token.collectionId ? collectionsMap.get(token.collectionId) : null
          );

          const tokenKey = `${normalized.contract}-${normalized.tokenId}`;
          processedIds.add(tokenKey);

          const existing = existingAssets.find(
            (a) => a.contract === normalized.contract && a.tokenId === normalized.tokenId
          );

          if (existing) {
            // Update existing asset
            await prisma.asset.update({
              where: { id: existing.id },
              data: {
                balance: normalized.balance,
                name: normalized.name,
                symbol: normalized.symbol,
                metadata: normalized.metadata as never,
                lastUpdated: normalized.lastUpdated,
              },
            });
            result.assetsUpdated++;
          } else {
            // Create new asset
            await prisma.asset.create({
              data: {
                tokenId: normalized.tokenId,
                contract: normalized.contract,
                name: normalized.name ?? "",
                symbol: normalized.symbol,
                decimals: normalized.decimals,
                balance: normalized.balance,
                type: normalized.type as AssetType,
                chainId: normalized.chainId,
                walletId: normalized.walletId,
                metadata: normalized.metadata as never,
                lastUpdated: normalized.lastUpdated,
              },
            });
            result.assetsAdded++;
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          result.errors.push(`Failed to process token ${token.tokenId}: ${msg}`);
        }
      }

      // Remove assets that no longer exist on-chain
      for (const existing of existingAssets) {
        const key = `${existing.contract}-${existing.tokenId}`;
        if (!processedIds.has(key)) {
          await prisma.asset.delete({ where: { id: existing.id } });
          result.assetsRemoved++;
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`Sync failed: ${msg}`);
    } finally {
      this.syncing.delete(walletAddress);
    }

    return result;
  }

  /**
   * Sync assets for all wallets belonging to a user.
   */
  async syncUserWallets(userId: string): Promise<SyncResult[]> {
    const wallets = await prisma.wallet.findMany({
      where: { userId },
    });

    const results: SyncResult[] = [];

    for (const wallet of wallets) {
      try {
        const result = await this.syncWallet(wallet.address, wallet.id, wallet.chainId);
        results.push(result);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        results.push({
          walletAddress: wallet.address,
          assetsAdded: 0,
          assetsUpdated: 0,
          assetsRemoved: 0,
          errors: [msg],
          syncedAt: new Date(),
        });
      }
    }

    return results;
  }

  /**
   * Start periodic polling for a wallet address.
   * Runs immediately, then every 60 seconds.
   */
  startPolling(walletAddress: string, walletId: string, chainId: number = 1): void {
    // Clear existing interval if any
    this.stopPolling(walletAddress);

    // Run immediately
    this.syncWallet(walletAddress, walletId, chainId).catch(() => {
      // Errors are captured in SyncResult, polling continues
    });

    // Set up interval
    const interval = setInterval(() => {
      this.syncWallet(walletAddress, walletId, chainId).catch(() => {
        // Polling continues even on error
      });
    }, SYNC_INTERVAL_MS);

    this.intervals.set(walletAddress, interval);
  }

  /**
   * Stop periodic polling for a wallet address.
   */
  stopPolling(walletAddress: string): void {
    const interval = this.intervals.get(walletAddress);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(walletAddress);
    }
  }

  /**
   * Stop all polling.
   */
  stopAllPolling(): void {
    const addresses = Array.from(this.intervals.keys());
    for (const address of addresses) {
      this.stopPolling(address);
    }
  }

  /**
   * Check if a wallet is currently syncing.
   */
  isSyncing(walletAddress: string): boolean {
    return this.syncing.has(walletAddress);
  }
}

// Singleton instance
export const assetIndexer = new AssetIndexer();
