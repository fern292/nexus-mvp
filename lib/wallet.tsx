"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createPublicClient, http as viemHttp, type Address, isAddress, toHex } from "viem";
import { mainnet } from "viem/chains";

interface ConnectedWallet {
  address: Address;
  chainId: number;
  connector: "injected" | "walletConnect";
  connectorName: string;
  provider?: unknown;
}

interface WalletContextValue {
  wallet: ConnectedWallet | null;
  isConnecting: boolean;
  isConnected: boolean;
  error: string | null;
  connectInjected: () => Promise<void>;
  connectWalletConnect: () => Promise<void>;
  disconnect: () => void;
  switchChain: (chainId: number) => Promise<void>;
  publicClient: ReturnType<typeof createPublicClient>;
}

const WalletContext = createContext<WalletContextValue | null>(null);

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider");
  return ctx;
}

const mainnetClient = createPublicClient({
  chain: mainnet,
  transport: viemHttp(),
});

export function useEnsName(address: Address | null) {
  const [ensName, setEnsName] = useState<string | null>(null);

  useEffect(() => {
    if (!address || !isAddress(address)) {
      setEnsName(null);
      return;
    }
    let cancelled = false;
    mainnetClient
      .getEnsName({ address })
      .then((name) => {
        if (!cancelled) setEnsName(name);
      })
      .catch(() => {
        if (!cancelled) setEnsName(null);
      });
    return () => {
      cancelled = true;
    };
  }, [address]);

  return ensName;
}

interface EIP1193Provider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener: (event: string, handler: (...args: unknown[]) => void) => void;
  isMetaMask?: boolean;
}

const STORAGE_KEY = "nexus_connected_wallet";

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [wallet, setWallet] = useState<ConnectedWallet | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const publicClient = useMemo(
    () =>
      createPublicClient({
        chain: mainnet,
        transport: viemHttp(),
      }),
    []
  );

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as ConnectedWallet;
        if (isAddress(parsed.address)) {
          setWallet(parsed);
        }
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (wallet) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(wallet));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [wallet]);

  const connectInjected = useCallback(async () => {
    setIsConnecting(true);
    setError(null);

    try {
      const eth = (window as unknown as { ethereum?: EIP1193Provider }).ethereum;
      if (!eth) {
        throw new Error("No wallet detected. Please install MetaMask or another Ethereum wallet.");
      }

      const accounts = (await eth.request({
        method: "eth_requestAccounts",
      })) as string[];

      const chainIdHex = (await eth.request({
        method: "eth_chainId",
      })) as string;

      const address = accounts[0] as Address;
      const chainId = parseInt(chainIdHex, 16);

      setWallet({
        address,
        chainId,
        connector: "injected",
        connectorName: eth.isMetaMask ? "MetaMask" : "Injected Wallet",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Connection failed";
      setError(msg);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const connectWalletConnect = useCallback(async () => {
    setIsConnecting(true);
    setError(null);

    try {
      const { EthereumProvider } = await import("@walletconnect/ethereum-provider");

      const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "nexus-mvp";

      const provider = await EthereumProvider.init({
        projectId,
        chains: [1],
        showQrModal: true,
        methods: ["eth_sendTransaction", "personal_sign", "eth_signTypedData"],
        events: ["chainChanged", "accountsChanged"],
        metadata: {
          name: "Nexus Portfolio",
          description: "Enjin NFT Portfolio Tracker",
          url: typeof window !== "undefined" ? window.location.origin : "",
          icons: [],
        },
      });

      await provider.enable();

      const accounts = provider.accounts as Address[];
      const chainId = provider.chainId;

      setWallet({
        address: accounts[0],
        chainId,
        connector: "walletConnect",
        connectorName: "Enjin Wallet",
        provider: provider as unknown,
      });

      provider.on("accountsChanged", (accs: unknown) => {
        const newAccs = accs as string[];
        if (newAccs.length === 0) {
          setWallet(null);
        } else {
          setWallet((prev) => (prev ? { ...prev, address: newAccs[0] as Address } : null));
        }
      });

      provider.on("chainChanged", (id: unknown) => {
        setWallet((prev) => (prev ? { ...prev, chainId: id as number } : null));
      });

      provider.on("disconnect", () => {
        setWallet(null);
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "WalletConnect failed";
      setError(msg);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setWallet((prev) => {
      if (prev?.provider) {
        try {
          (prev.provider as { disconnect?: () => Promise<void> }).disconnect?.();
        } catch {
          // ignore
        }
      }
      return null;
    });
    setError(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const switchChain = useCallback(
    async (chainId: number) => {
      if (!wallet) return;

      try {
        const eth = (window as unknown as { ethereum?: EIP1193Provider }).ethereum;
        if (wallet.connector === "injected" && eth) {
          await eth.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: toHex(chainId) }],
          });
          setWallet((prev) => (prev ? { ...prev, chainId } : null));
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to switch chain";
        setError(msg);
      }
    },
    [wallet]
  );

  const value = useMemo<WalletContextValue>(
    () => ({
      wallet,
      isConnecting,
      isConnected: !!wallet,
      error,
      connectInjected,
      connectWalletConnect,
      disconnect,
      switchChain,
      publicClient,
    }),
    [
      wallet,
      isConnecting,
      error,
      connectInjected,
      connectWalletConnect,
      disconnect,
      switchChain,
      publicClient,
    ]
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}
