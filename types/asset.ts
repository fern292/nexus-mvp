// Asset types for the Nexus Enjin NFT Portfolio Tracker

export type AssetType = "TOKEN" | "NFT";

export interface AssetMetadata {
  description?: string;
  image?: string;
  attributes?: Array<{ trait_type: string; value: string | number }>;
  external_url?: string;
  animation_url?: string;
  [key: string]: unknown;
}

export interface Asset {
  id: string;
  tokenId: string | null;
  contract: string;
  name: string | null;
  symbol: string | null;
  decimals: number;
  balance: string;
  type: AssetType;
  chainId: number;
  walletId: string;
  metadata: AssetMetadata | null;
  image: string | null;
  game: string | null;
  rarity: string | null;
  lastPrice: string | null;
  lastUpdated: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Normalized asset for API responses (wallet-agnostic)
export interface AssetSummary {
  id: string;
  type: AssetType;
  name: string | null;
  image: string | null;
  contract: string;
  chainId: number;
  balance: string;
  game: string | null;
  rarity: string | null;
  lastPrice: string | null;
  tokenId: string | null;
  symbol: string | null;
  decimals: number;
  metadata: AssetMetadata | null;
  lastUpdated: Date;
}

// Enjin Platform API types
export interface EnjinToken {
  id: string;
  tokenId: string;
  name: string | null;
  symbol: string | null;
  decimals: number;
  totalSupply: string | null;
  circulatingSupply: string | null;
  creator: string | null;
  collectionId: string | null;
  media: EnjinTokenMedia | null;
  attributes: EnjinTokenAttribute[] | null;
  balance: string | null;
  walletAddress: string | null;
}

export interface EnjinTokenMedia {
  url: string | null;
  thumbnailUrl: string | null;
  fileType: string | null;
  animationUrl: string | null;
}

export interface EnjinTokenAttribute {
  key: string;
  value: string;
}

export interface EnjinCollection {
  id: string;
  name: string | null;
  description: string | null;
  image: string | null;
  externalUrl: string | null;
  royaltyAddress: string | null;
  royaltyPercentage: number | null;
}

export interface EnjinWalletBalance {
  tokenId: string;
  walletAddress: string;
  balance: string;
}

// Indexer state
export interface IndexerState {
  walletAddress: string;
  lastSyncAt: Date | null;
  isSyncing: boolean;
  error: string | null;
}

export interface SyncResult {
  walletAddress: string;
  assetsAdded: number;
  assetsUpdated: number;
  assetsRemoved: number;
  errors: string[];
  syncedAt: Date;
}
