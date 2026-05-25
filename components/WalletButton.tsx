"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import { useAccount, useSignMessage, useConnect, useDisconnect } from "wagmi";
import { injected } from "wagmi/connectors";
import { SiweMessage } from "siwe";
import { useCallback, useState } from "react";

export function WalletButton() {
  const { data: session } = useSession();
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const [loading, setLoading] = useState(false);

  const handleSignIn = useCallback(async () => {
    try {
      setLoading(true);
      if (!isConnected) {
        await connect({ connector: injected() });
      }

      if (!address) throw new Error("No address");

      const nonce = Math.random().toString(36).substring(2);
      const message = new SiweMessage({
        domain: window.location.host,
        address,
        statement: "Sign in with Ethereum to Nexus",
        uri: window.location.origin,
        version: "1",
        chainId: 1,
        nonce,
      });

      const signature = await signMessageAsync({
        message: message.prepareMessage(),
      });

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
  }, [isConnected, connect, signMessageAsync, address]);

  if (session?.user) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-400">
          {address?.slice(0, 6)}...{address?.slice(-4)}
        </span>
        <button
          onClick={() => { disconnect(); signOut(); }}
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
