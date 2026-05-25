"use client";

import { useSession } from "next-auth/react";
import { useWallet } from "@/lib/wallet";
import { WalletButtonV2 } from "@/components/WalletButton";

export default function WalletsPage() {
  const { data: session } = useSession();
  const { wallet: activeWallet } = useWallet();
  const wallets =
    (
      session?.user as {
        wallets?: Array<{ id: string; address: string; chainId: number; isPrimary: boolean }>;
      }
    )?.wallets || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Wallets</h1>
          <p className="text-gray-400">Manage connected wallets</p>
        </div>
        <WalletButtonV2 />
      </div>

      {wallets.length === 0 ? (
        <div className="rounded-lg border border-gray-800 p-8 text-center">
          <p className="text-gray-400">No wallets connected yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {wallets.map((w) => (
            <div
              key={w.id}
              className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900/50 p-4"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-800">
                  <span className="text-lg">🔗</span>
                </div>
                <div>
                  <div className="font-mono text-sm text-white">
                    {w.address.slice(0, 6)}...{w.address.slice(-4)}
                  </div>
                  <div className="text-xs text-gray-500">
                    Chain ID: {w.chainId}
                    {w.isPrimary && (
                      <span className="ml-2 rounded bg-blue-900/50 px-1.5 py-0.5 text-blue-400">
                        Primary
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {activeWallet?.address.toLowerCase() === w.address.toLowerCase() && (
                <span className="rounded bg-green-900/50 px-2 py-1 text-xs text-green-400">
                  Connected
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
