"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import { SiweMessage } from "siwe";
import { useWallet, useEnsName } from "@/lib/wallet";

interface WalletOption {
  id: string;
  name: string;
  description: string;
  icon: string;
  connectorId: "injected" | "walletConnect";
}

const WALLET_OPTIONS: WalletOption[] = [
  {
    id: "enjin",
    name: "Enjin Wallet",
    description: "Connect via WalletConnect",
    icon: "🔷",
    connectorId: "walletConnect",
  },
  {
    id: "metamask",
    name: "MetaMask",
    description: "Connect using browser extension",
    icon: "🦊",
    connectorId: "injected",
  },
];

export function WalletModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { isConnecting, connectInjected, connectWalletConnect, error } = useWallet();
  const [connectingId, setConnectingId] = useState<string | null>(null);

  const handleConnect = useCallback(
    async (option: WalletOption) => {
      setConnectingId(option.id);
      try {
        if (option.connectorId === "walletConnect") {
          await connectWalletConnect();
        } else {
          await connectInjected();
        }
        onClose();
      } catch (err) {
        console.error("Connection failed:", err);
      } finally {
        setConnectingId(null);
      }
    },
    [connectInjected, connectWalletConnect, onClose]
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-gray-700 bg-gray-900 p-6 shadow-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-xl font-semibold text-white">Connect Wallet</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-800 hover:text-white"
          >
            ✕
          </button>
        </div>
        <div className="space-y-3">
          {WALLET_OPTIONS.map((option) => (
            <button
              key={option.id}
              onClick={() => handleConnect(option)}
              disabled={isConnecting}
              className="flex w-full items-center gap-4 rounded-xl border border-gray-700 bg-gray-800/50 p-4 text-left transition-all hover:border-blue-500 hover:bg-gray-800 disabled:opacity-50"
            >
              <span className="text-2xl">{option.icon}</span>
              <div className="flex-1">
                <div className="font-medium text-white">{option.name}</div>
                <div className="text-sm text-gray-400">{option.description}</div>
              </div>
              {connectingId === option.id && (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
              )}
            </button>
          ))}
        </div>
        {error && (
          <div className="mt-4 rounded-lg bg-red-900/30 p-3 text-sm text-red-400">{error}</div>
        )}
        <p className="mt-4 text-center text-xs text-gray-500">
          By connecting, you agree to the Terms of Service
        </p>
      </div>
    </div>
  );
}

export function WalletButtonV2() {
  const { wallet, isConnected, isConnecting, disconnect: disconnectWallet } = useWallet();
  const { data: session, status } = useSession();
  const ensName = useEnsName(wallet?.address ?? null);
  const [showModal, setShowModal] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const handleSignIn = useCallback(async () => {
    if (!wallet?.address) return;

    try {
      setIsAuthenticating(true);

      const nonceRes = await fetch("/api/auth/nonce");
      const { nonce } = await nonceRes.json();

      const message = new SiweMessage({
        domain: window.location.host,
        address: wallet.address,
        statement: "Sign in with Ethereum to Nexus",
        uri: window.location.origin,
        version: "1",
        chainId: wallet.chainId,
        nonce,
      });

      let signature: string;

      if (wallet.connector === "injected") {
        const eth = (
          window as unknown as {
            ethereum?: {
              request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
            };
          }
        ).ethereum;
        if (!eth) throw new Error("Wallet not available");

        signature = (await eth.request({
          method: "personal_sign",
          params: [message.prepareMessage(), wallet.address],
        })) as string;
      } else {
        // WalletConnect signing
        if (wallet.provider) {
          signature = (await (
            wallet.provider as {
              request: (args: { method: string; params: unknown[] }) => Promise<unknown>;
            }
          ).request({
            method: "personal_sign",
            params: [message.prepareMessage(), wallet.address],
          })) as string;
        } else {
          throw new Error("WalletConnect provider not available");
        }
      }

      await signIn("credentials", {
        message: JSON.stringify(message),
        signature,
        redirect: false,
      });
    } catch (err) {
      console.error("SIWE sign-in failed:", err);
    } finally {
      setIsAuthenticating(false);
    }
  }, [wallet]);

  // Auto-authenticate when wallet connects and no session
  useEffect(() => {
    if (isConnected && wallet && !session && status !== "loading" && !isAuthenticating) {
      handleSignIn();
    }
  }, [isConnected, wallet, session, status, isAuthenticating, handleSignIn]);

  const handleDisconnect = useCallback(() => {
    disconnectWallet();
    signOut({ redirect: false });
  }, [disconnectWallet]);

  const displayName =
    ensName ||
    (wallet?.address ? `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}` : null);

  if (status === "loading" || isConnecting || isAuthenticating) {
    return (
      <div className="flex items-center gap-2">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        <span className="text-sm text-gray-400">
          {isAuthenticating ? "Signing in..." : "Connecting..."}
        </span>
      </div>
    );
  }

  if (isConnected && session && wallet) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 rounded-lg bg-gray-800 px-3 py-2">
          <div className="h-2 w-2 rounded-full bg-green-500" />
          <div className="flex flex-col">
            <span className="text-sm font-medium text-white">{displayName}</span>
            <span className="text-xs text-gray-400">{wallet.connectorName}</span>
          </div>
        </div>
        <button
          onClick={handleDisconnect}
          className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm font-medium text-gray-300 transition-colors hover:border-red-500 hover:bg-red-900/20 hover:text-red-400"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
      >
        Connect Wallet
      </button>
      <WalletModal isOpen={showModal} onClose={() => setShowModal(false)} />
    </>
  );
}
