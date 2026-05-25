export interface WalletInfo {
  address: string;
  chainId: number;
  isPrimary: boolean;
}

export interface AssetData {
  id: string;
  tokenId?: string;
  contract: string;
  name?: string;
  symbol?: string;
  decimals: number;
  balance: string;
  type: "TOKEN" | "NFT";
  chainId: number;
  metadata?: Record<string, unknown>;
}

export interface AlertData {
  id: string;
  type: "PRICE_ABOVE" | "PRICE_BELOW" | "BALANCE_CHANGE" | "NFT_LISTED" | "NFT_SOLD";
  condition: Record<string, unknown>;
  isActive: boolean;
}

export interface PortfolioSnapshotData {
  id: string;
  totalUsd: string;
  data: Record<string, unknown>;
  createdAt: string;
}

export interface SiweMessage {
  domain: string;
  address: string;
  statement?: string;
  uri: string;
  version: string;
  chainId: number;
  nonce: string;
  issuedAt?: string;
  expirationTime?: string;
  notBefore?: string;
  requestId?: string;
  resources?: string[];
}
