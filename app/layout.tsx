"use client";

import { useState } from "react";
import { SessionProvider } from "next-auth/react";
import { WalletProvider } from "@/lib/wallet";
import { Sidebar } from "@/components/Sidebar";
import { WalletButtonV2 } from "@/components/WalletButton";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <html lang="en">
      <head>
        <title>Nexus Portfolio — Enjin NFT Tracker</title>
        <meta
          name="description"
          content="Track your Enjin NFT and token portfolio. Real-time asset indexing, price alerts, and wallet management."
        />
        <meta property="og:title" content="Nexus Portfolio — Enjin NFT Tracker" />
        <meta
          property="og:description"
          content="Track your Enjin NFT and token portfolio. Real-time asset indexing, price alerts, and wallet management."
        />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Nexus Portfolio" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Nexus Portfolio — Enjin NFT Tracker" />
        <meta
          name="twitter:description"
          content="Track your Enjin NFT and token portfolio. Real-time asset indexing, price alerts, and wallet management."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className="flex min-h-screen bg-gray-950 text-white">
        <SessionProvider>
          <WalletProvider>
            <ErrorBoundary>
              {/* Mobile overlay */}
              {sidebarOpen && (
                <div
                  className="fixed inset-0 z-30 bg-black/50 lg:hidden"
                  onClick={() => setSidebarOpen(false)}
                />
              )}
              <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
              <div className="flex flex-1 flex-col lg:ml-64">
                <header className="flex items-center justify-between border-b border-gray-800 px-4 py-3 lg:px-6 lg:py-4">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setSidebarOpen(true)}
                      className="rounded-lg p-2 text-gray-400 hover:bg-gray-800 hover:text-white lg:hidden"
                      aria-label="Open menu"
                    >
                      <svg
                        className="h-6 w-6"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 6h16M4 12h16M4 18h16"
                        />
                      </svg>
                    </button>
                    <h2 className="text-base font-semibold lg:text-lg">Nexus Portfolio</h2>
                  </div>
                  <WalletButtonV2 />
                </header>
                <main className="flex-1 p-4 lg:p-6">{children}</main>
              </div>
            </ErrorBoundary>
          </WalletProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
