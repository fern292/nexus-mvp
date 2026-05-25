import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await getSession();

  if (!session?.user) {
    return (
      <div className="flex flex-col items-center justify-center gap-4">
        <h1 className="text-3xl font-bold">Welcome to Nexus</h1>
        <p className="text-gray-400">Connect your wallet to track your portfolio</p>
      </div>
    );
  }

  const wallets = await prisma.wallet.findMany({
    where: { userId: (session.user as { id: string }).id },
    include: { assets: true },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-gray-400">Overview of your portfolio</p>
      </div>

      {wallets.length === 0 ? (
        <div className="rounded-lg border border-gray-800 p-8 text-center">
          <p className="text-gray-400">No wallets connected yet.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {wallets.map((wallet) => (
            <div key={wallet.id} className="rounded-lg border border-gray-800 p-4">
              <p className="text-sm text-gray-400">Wallet</p>
              <p className="font-mono text-sm">
                {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
              </p>
              <p className="mt-2 text-lg font-semibold">{wallet.assets.length} assets</p>
              <p className="text-xs text-gray-500">Chain ID: {wallet.chainId}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
