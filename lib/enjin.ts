import type { EnjinToken, EnjinCollection, EnjinWalletBalance, AssetMetadata } from "@/types/asset";

const ENJIN_PLATFORM_URL = "https://platform.enjin.io";
const ENJIN_GRAPHQL_ENDPOINT = `${ENJIN_PLATFORM_URL}/graphql`;
const ENJIN_REST_ENDPOINT = `${ENJIN_PLATFORM_URL}/api/v1`;

// Rate limiting configuration
const RATE_LIMIT_DELAY_MS = 1000; // 1 request per second
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

interface GraphQLError {
  message: string;
  locations?: Array<{ line: number; column: number }>;
  path?: Array<string | number>;
}

interface GraphQLResponse<T> {
  data?: T;
  errors?: GraphQLError[];
}

interface EnjinTokensResponse {
  GetWallet: {
    tokens: EnjinToken[];
    nextCursor: string | null;
  } | null;
}

interface EnjinCollectionsResponse {
  GetCollections: {
    collections: EnjinCollection[];
    nextCursor: string | null;
  } | null;
}

interface EnjinBalancesResponse {
  GetBalances: {
    balances: EnjinWalletBalance[];
    nextCursor: string | null;
  } | null;
}

/**
 * Sleep utility for rate limiting
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute a GraphQL query against the Enjin Platform API
 */
async function graphqlQuery<T>(
  query: string,
  variables: Record<string, unknown> = {},
  apiKey?: string
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        await sleep(RETRY_DELAY_MS * attempt);
      }

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (apiKey) {
        headers["Authorization"] = `Bearer ${apiKey}`;
      }

      const response = await fetch(ENJIN_GRAPHQL_ENDPOINT, {
        method: "POST",
        headers,
        body: JSON.stringify({ query, variables }),
      });

      if (response.status === 429) {
        // Rate limited — wait and retry
        const retryAfter = response.headers.get("Retry-After");
        const waitMs = retryAfter ? parseInt(retryAfter) * 1000 : RATE_LIMIT_DELAY_MS * 3;
        await sleep(waitMs);
        continue;
      }

      if (!response.ok) {
        throw new Error(`Enjin API HTTP ${response.status}: ${response.statusText}`);
      }

      const json = (await response.json()) as GraphQLResponse<T>;

      if (json.errors && json.errors.length > 0) {
        const errorMessages = json.errors.map((e) => e.message).join("; ");
        throw new Error(`Enjin GraphQL error: ${errorMessages}`);
      }

      if (!json.data) {
        throw new Error("Enjin API returned no data");
      }

      return json.data;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < MAX_RETRIES - 1) {
        await sleep(RATE_LIMIT_DELAY_MS);
      }
    }
  }

  throw lastError ?? new Error("Enjin API request failed after retries");
}

/**
 * Enjin Platform API Client
 *
 * Supports both GraphQL and REST endpoints for querying wallet assets.
 * The Enjin Platform uses a project-based API structure.
 */
export class EnjinClient {
  private apiKey: string | null;
  private projectId: string | null;

  constructor(options?: { apiKey?: string; projectId?: string }) {
    this.apiKey = options?.apiKey ?? null;
    this.projectId = options?.projectId ?? null;
  }

  /**
   * Get all tokens (NFTs + fungible) for a wallet address.
   * Handles pagination automatically.
   */
  async getWalletTokens(
    walletAddress: string,
    options?: { collectionId?: string; cursor?: string; limit?: number }
  ): Promise<{ tokens: EnjinToken[]; nextCursor: string | null }> {
    const limit = options?.limit ?? 50;

    const query = `
      query GetWalletTokens(
        $address: String!
        $collectionId: String
        $cursor: String
        $limit: Int!
      ) {
        GetWallet(
          address: $address
          collectionId: $collectionId
          cursor: $cursor
          limit: $limit
        ) {
          tokens {
            id
            tokenId
            name
            symbol
            decimals
            totalSupply
            circulatingSupply
            creator
            collectionId
            media {
              url
              thumbnailUrl
              fileType
              animationUrl
            }
            attributes {
              key
              value
            }
            balance
            walletAddress
          }
          nextCursor
        }
      }
    `;

    const variables: Record<string, unknown> = {
      address: walletAddress,
      limit,
    };

    if (options?.collectionId) {
      variables.collectionId = options.collectionId;
    }
    if (options?.cursor) {
      variables.cursor = options.cursor;
    }

    const data = await graphqlQuery<EnjinTokensResponse>(
      query,
      variables,
      this.apiKey ?? undefined
    );

    const result = data.GetWallet;
    if (!result) {
      return { tokens: [], nextCursor: null };
    }

    return {
      tokens: result.tokens,
      nextCursor: result.nextCursor,
    };
  }

  /**
   * Get ALL tokens for a wallet, fetching all pages.
   */
  async getAllWalletTokens(walletAddress: string): Promise<EnjinToken[]> {
    const allTokens: EnjinToken[] = [];
    let cursor: string | null = null;

    do {
      const result = await this.getWalletTokens(walletAddress, { cursor: cursor ?? undefined });
      allTokens.push(...result.tokens);
      cursor = result.nextCursor;

      // Rate limit between pages
      if (cursor) {
        await sleep(RATE_LIMIT_DELAY_MS);
      }
    } while (cursor);

    return allTokens;
  }

  /**
   * Get collection details by ID
   */
  async getCollection(collectionId: string): Promise<EnjinCollection | null> {
    const query = `
      query GetCollection($id: String!) {
        GetCollections(id: $id) {
          collections {
            id
            name
            description
            image
            externalUrl
            royaltyAddress
            royaltyPercentage
          }
        }
      }
    `;

    const data = await graphqlQuery<EnjinCollectionsResponse>(
      query,
      { id: collectionId },
      this.apiKey ?? undefined
    );

    const collections = data.GetCollections?.collections;
    if (!collections || collections.length === 0) {
      return null;
    }

    return collections[0];
  }

  /**
   * Get token balances for a wallet
   */
  async getWalletBalances(
    walletAddress: string,
    options?: { cursor?: string; limit?: number }
  ): Promise<{ balances: EnjinWalletBalance[]; nextCursor: string | null }> {
    const limit = options?.limit ?? 50;

    const query = `
      query GetWalletBalances(
        $address: String!
        $cursor: String
        $limit: Int!
      ) {
        GetBalances(
          address: $address
          cursor: $cursor
          limit: $limit
        ) {
          balances {
            tokenId
            walletAddress
            balance
          }
          nextCursor
        }
      }
    `;

    const variables: Record<string, unknown> = {
      address: walletAddress,
      limit,
    };

    if (options?.cursor) {
      variables.cursor = options.cursor;
    }

    const data = await graphqlQuery<EnjinBalancesResponse>(
      query,
      variables,
      this.apiKey ?? undefined
    );

    const result = data.GetBalances;
    if (!result) {
      return { balances: [], nextCursor: null };
    }

    return {
      balances: result.balances,
      nextCursor: result.nextCursor,
    };
  }

  /**
   * Get all balances for a wallet, fetching all pages.
   */
  async getAllWalletBalances(walletAddress: string): Promise<EnjinWalletBalance[]> {
    const allBalances: EnjinWalletBalance[] = [];
    let cursor: string | null = null;

    do {
      const result = await this.getWalletBalances(walletAddress, { cursor: cursor ?? undefined });
      allBalances.push(...result.balances);
      cursor = result.nextCursor;

      if (cursor) {
        await sleep(RATE_LIMIT_DELAY_MS);
      }
    } while (cursor);

    return allBalances;
  }

  /**
   * Parse metadata from token attributes into a structured format
   */
  static parseMetadata(token: EnjinToken): AssetMetadata {
    const metadata: AssetMetadata = {};

    if (token.media?.url) {
      metadata.image = token.media.url;
    } else if (token.media?.thumbnailUrl) {
      metadata.image = token.media.thumbnailUrl;
    }

    if (token.media?.animationUrl) {
      metadata.animation_url = token.media.animationUrl;
    }

    if (token.attributes && token.attributes.length > 0) {
      metadata.attributes = token.attributes.map((attr) => ({
        trait_type: attr.key,
        value: attr.value,
      }));

      // Extract common metadata fields from attributes
      for (const attr of token.attributes) {
        const key = attr.key.toLowerCase();
        if (key === "description" || key === "desc") {
          metadata.description = attr.value;
        }
        if (key === "external_url" || key === "externalurl" || key === "url") {
          metadata.external_url = attr.value;
        }
      }
    }

    return metadata;
  }

  /**
   * Extract game name from collection or token data
   */
  static extractGameName(token: EnjinToken, collection?: EnjinCollection | null): string | null {
    // Try collection name first
    if (collection?.name) {
      return collection.name;
    }

    // Try to extract from token attributes
    if (token.attributes) {
      const gameAttr = token.attributes.find(
        (a) => a.key.toLowerCase() === "game" || a.key.toLowerCase() === "project"
      );
      if (gameAttr) {
        return gameAttr.value;
      }
    }

    // Fall back to token name prefix (e.g., "GameName #123")
    if (token.name) {
      const match = token.name.match(/^([^#]+)/);
      if (match) {
        return match[1].trim();
      }
    }

    return null;
  }

  /**
   * Extract rarity from token attributes
   */
  static extractRarity(token: EnjinToken): string | null {
    if (!token.attributes) return null;

    const rarityAttr = token.attributes.find(
      (a) =>
        a.key.toLowerCase() === "rarity" ||
        a.key.toLowerCase() === "tier" ||
        a.key.toLowerCase() === "rank"
    );

    return rarityAttr?.value ?? null;
  }
}

// Singleton instance — configured from environment
export const enjin = new EnjinClient({
  apiKey: process.env.ENJIN_API_KEY || undefined,
  projectId: process.env.ENJIN_PROJECT_ID || undefined,
});
