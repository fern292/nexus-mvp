"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import { SiweMessage } from "siwe";
import { useCallback, useState } from "react";

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on: (event: string, handler: (...args: unknown[]) => void) => void;
      removeListener: (event: string, handler: (...args: unknown[]) => void) => void;
      isMetaMask?: boolean;
    };
  }
}

export function WalletButton() {
  const { data: session, status } = useSession();
  const [address, setAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSignIn = useCallback(async () => {
    if (!window.ethereum) {
      alert("Please install MetaMask or another Ethereum wallet");
      return;
    }

    try {
      setLoading(true);

      const accounts = (await window.ethereum.request({
        method: "eth_requestAccounts",
      })) as string[];

      const userAddress = accounts[0];
      setAddress(userAddress);

      const nonce = Math.random().toString(36).substring(2);
      const message = new SiweMessage({
        domain: window.location.host,
        address: userAddress,
        statement: "Sign in with Ethereum to Nexus",
        uri: window.location.origin,
        version: "1",
        chainId: 1,
        nonce,
      });

      const signature = (await window.ethereum.request({
        method: "personal_sign",
        params: [message.prepareMessage(), userAddress],
      })) as string;

      await signIn("credentials", {
        message: JSON.stringify(message),
        signature,
        redirect: false,
      });
    } catch (err) {
      console.error("Sign in failed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  if (status === "loading") {
    return (
      <button
        disabled
        className="rounded-lg bg-gray-600 px-4 py-2 text-sm font-medium text-white opacity-50"
      >
        Loading...
      </button>
    );
  }

  if (session?.user) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-400">
          {address?.slice(0, 6)}...{address?.slice(-4)}
        </span>
        <button
          onClick={() => {
            setAddress(null);
            signOut();
          }}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleSignIn}
      disabled={loading}
      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
    >
      {loading ? "Connecting..." : "Connect Wallet"}
    </button>
  );
}
