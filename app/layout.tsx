"use client";

import { SessionProvider } from "next-auth/react";
import { Sidebar } from "@/components/Sidebar";
import { WalletButton } from "@/components/WalletButton";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen bg-gray-950 text-white">
        <SessionProvider>
          <Sidebar />
          <div className="flex flex-1 flex-col">
            <header className="flex items-center justify-between border-b border-gray-800 px-6 py-4">
              <h2 className="text-lg font-semibold">Nexus Portfolio</h2>
              <WalletButton />
            </header>
            <main className="flex-1 p-6">{children}</main>
          </div>
        </SessionProvider>
      </body>
    </html>
  );
}
