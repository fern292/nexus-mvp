"use client";

import { SessionProvider } from "next-auth/react";
import { WalletProvider } from "@/lib/wallet";
import { Sidebar } from "@/components/Sidebar";
import { WalletButtonV2 } from "@/components/WalletButton";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen bg-gray-950 text-white">
        <SessionProvider>
          <WalletProvider>
            <Sidebar />
            <div className="flex flex-1 flex-col">
              <header className="flex items-center justify-between border-b border-gray-800 px-6 py-4">
                <h2 className="text-lg font-semibold">Nexus Portfolio</h2>
                <WalletButtonV2 />
              </header>
              <main className="flex-1 p-6">{children}</main>
            </div>
          </WalletProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
