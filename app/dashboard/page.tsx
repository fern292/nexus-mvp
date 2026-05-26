"use client";

import { useState, useEffect, useCallback, useMemo } from "react";

// ── Types ──────────────────────────────────────────────────────────────────

interface Asset {
  id: string;
  tokenId: string | null;
  contract: string;
  name: string | null;
  symbol: string | null;
  decimals: number;
  balance: string;
  type: "TOKEN" | "NFT";
  chainId: number;
  metadata: Record<string, unknown> | null;
  lastUpdated: string;
  createdAt: string;
  wallet: { address: string; chainId: number };
}

interface AssetSummary {
  data: Asset[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface DashboardSummary {
  totalAssets: number;
  nftCount: number;
  tokenCount: number;
  walletCount: number;
  lastSyncAt: string | null;
}

interface AllocationData {
  byType: { name: string; count: number }[];
  byChain: { name: string; count: number }[];
  byContract: { name: string; count: number }[];
}

interface Activity {
  id: string;
  assetName: string;
  assetType: string;
  contract: string;
  action: string;
  timestamp: string;
}

type SortField = "name" | "balance" | "lastUpdated" | "createdAt" | "type";
type SortOrder = "asc" | "desc";
type FilterType = "ALL" | "NFT" | "TOKEN";

// ── Helpers ────────────────────────────────────────────────────────────────

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatBalance(balance: string, decimals: number): string {
  try {
    const val = BigInt(balance) / BigInt(10 ** Math.min(decimals, 18));
    const num = Number(val);
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`;
    if (num >= 1) return num.toLocaleString(undefined, { maximumFractionDigits: 4 });
    return Number(`0.${balance.padStart(decimals, "0").slice(0, 6)}`).toFixed(6);
  } catch {
    return balance;
  }
}

// ── Color palette for charts ───────────────────────────────────────────────

const COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#a855f7",
  "#d946ef",
  "#ec4899",
  "#f43f5e",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#06b6d4",
  "#3b82f6",
  "#2563eb",
];

// ── Skeleton Components ────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-lg border border-gray-800 bg-gray-900/50 p-5">
      <div className="h-4 w-24 rounded bg-gray-800" />
      <div className="mt-3 h-8 w-32 rounded bg-gray-800" />
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-lg border border-gray-800 bg-gray-900/50 p-4">
          <div className="h-32 rounded bg-gray-800" />
          <div className="mt-3 h-4 w-3/4 rounded bg-gray-800" />
          <div className="mt-2 h-3 w-1/2 rounded bg-gray-800" />
        </div>
      ))}
    </div>
  );
}

function SkeletonChart() {
  return (
    <div className="animate-pulse rounded-lg border border-gray-800 bg-gray-900/50 p-5">
      <div className="h-5 w-32 rounded bg-gray-800" />
      <div className="mt-4 flex items-center justify-center">
        <div className="h-48 w-48 rounded-full bg-gray-800" />
      </div>
    </div>
  );
}

// ── Overview Cards ─────────────────────────────────────────────────────────

function OverviewCards({ summary }: { summary: DashboardSummary | null }) {
  if (!summary) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  const cards = [
    { label: "Total Assets", value: summary.totalAssets.toString(), icon: "📦" },
    { label: "NFTs", value: summary.nftCount.toString(), icon: "🖼️" },
    { label: "Tokens", value: summary.tokenCount.toString(), icon: "🪙" },
    { label: "Wallets", value: summary.walletCount.toString(), icon: "👛" },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-lg border border-gray-800 bg-gray-900/50 p-5 transition-colors hover:border-gray-700"
        >
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-400">{card.label}</p>
            <span className="text-lg">{card.icon}</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-white">{card.value}</p>
        </div>
      ))}
    </div>
  );
}

// ── Allocation Charts ──────────────────────────────────────────────────────

function AllocationCharts({ allocation }: { allocation: AllocationData | null }) {
  if (!allocation) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <SkeletonChart />
        <SkeletonChart />
      </div>
    );
  }

  if (allocation.byType.length === 0) {
    return (
      <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-8 text-center">
        <p className="text-gray-400">No allocation data yet. Sync your wallet to see charts.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* By Type */}
      <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-5">
        <h3 className="mb-4 text-sm font-medium text-gray-300">Assets by Type</h3>
        <div className="space-y-3">
          {allocation.byType.map((item, i) => {
            const pct = allocation.byType.reduce((s, x) => s + x.count, 0);
            const pctVal = pct > 0 ? Math.round((item.count / pct) * 100) : 0;
            return (
              <div key={item.name}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="text-gray-300">{item.name}</span>
                  <span className="text-gray-400">
                    {item.count} ({pctVal}%)
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-gray-800">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${pctVal}%`,
                      backgroundColor: COLORS[i % COLORS.length],
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* By Contract (top collections) */}
      <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-5">
        <h3 className="mb-4 text-sm font-medium text-gray-300">Top Collections</h3>
        {allocation.byContract.length === 0 ? (
          <p className="text-sm text-gray-500">No collections found.</p>
        ) : (
          <div className="space-y-3">
            {allocation.byContract.slice(0, 6).map((item, i) => {
              const pct = allocation.byContract.reduce((s, x) => s + x.count, 0);
              const pctVal = pct > 0 ? Math.round((item.count / pct) * 100) : 0;
              return (
                <div key={item.name}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="truncate font-mono text-gray-300" title={item.name}>
                      {formatAddress(item.name)}
                    </span>
                    <span className="shrink-0 text-gray-400">
                      {item.count} ({pctVal}%)
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-gray-800">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${pctVal}%`,
                        backgroundColor: COLORS[i % COLORS.length],
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Asset Grid ─────────────────────────────────────────────────────────────

function AssetGrid() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filterType, setFilterType] = useState<FilterType>("ALL");
  const [sortField, setSortField] = useState<SortField>("lastUpdated");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [search, setSearch] = useState("");

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "24",
        sort: sortField,
        order: sortOrder,
      });
      if (filterType !== "ALL") params.set("type", filterType);
      if (search) params.set("search", search);

      const res = await fetch(`/api/assets?${params}`);
      if (!res.ok) throw new Error("Failed to fetch assets");
      const data: AssetSummary = await res.json();
      setAssets(data.data);
      setTotalPages(data.pagination.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [page, filterType, sortField, sortOrder, search]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  if (loading && assets.length === 0) return <SkeletonGrid />;
  if (error) {
    return (
      <div className="rounded-lg border border-red-900/50 bg-red-950/20 p-6 text-center">
        <p className="text-red-400">Error loading assets: {error}</p>
        <button
          onClick={fetchAssets}
          className="mt-3 rounded-lg bg-gray-800 px-4 py-2 text-sm text-white hover:bg-gray-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters & Sort */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        {/* Search */}
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Search assets..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-gray-800 bg-gray-900 px-4 py-2 pl-9 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">🔍</span>
        </div>

        {/* Type filter */}
        <div className="flex rounded-lg border border-gray-800 bg-gray-900">
          {(["ALL", "NFT", "TOKEN"] as FilterType[]).map((t) => (
            <button
              key={t}
              onClick={() => {
                setFilterType(t);
                setPage(1);
              }}
              className={`px-3 py-2 text-sm transition-colors ${
                filterType === t ? "bg-indigo-600 text-white" : "text-gray-400 hover:text-white"
              } ${t === "ALL" ? "rounded-l-lg" : ""} ${t === "TOKEN" ? "rounded-r-lg" : ""}`}
            >
              {t === "ALL" ? "All" : t}
            </button>
          ))}
        </div>

        {/* Sort */}
        <select
          value={`${sortField}:${sortOrder}`}
          onChange={(e) => {
            const [field, order] = e.target.value.split(":");
            setSortField(field as SortField);
            setSortOrder(order as SortOrder);
            setPage(1);
          }}
          className="rounded-lg border border-gray-800 bg-gray-900 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
        >
          <option value="lastUpdated:desc">Recently Updated</option>
          <option value="createdAt:desc">Recently Added</option>
          <option value="name:asc">Name A-Z</option>
          <option value="name:desc">Name Z-A</option>
          <option value="balance:desc">Balance High-Low</option>
          <option value="balance:asc">Balance Low-High</option>
        </select>
      </div>

      {/* Asset cards */}
      {assets.length === 0 ? (
        <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-12 text-center">
          <p className="text-4xl">📭</p>
          <p className="mt-3 text-lg font-medium text-gray-300">No assets found</p>
          <p className="mt-1 text-sm text-gray-500">
            {search || filterType !== "ALL"
              ? "Try adjusting your filters"
              : "Connect a wallet and sync to see your assets here"}
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {assets.map((asset) => (
              <div
                key={asset.id}
                className="group rounded-lg border border-gray-800 bg-gray-900/50 p-4 transition-all hover:border-gray-600 hover:bg-gray-900"
              >
                {/* Image placeholder */}
                <div className="flex h-32 items-center justify-center rounded-lg bg-gray-800/50">
                  {asset.type === "NFT" ? (
                    <div className="text-center">
                      <span className="text-3xl">🖼️</span>
                      <p className="mt-1 text-xs text-gray-500">NFT</p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <span className="text-3xl">🪙</span>
                      <p className="mt-1 text-xs text-gray-500">{asset.symbol ?? "Token"}</p>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="mt-3">
                  <h4 className="truncate text-sm font-medium text-white">
                    {asset.name ?? asset.symbol ?? formatAddress(asset.contract)}
                  </h4>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-xs text-gray-500">
                      {asset.type === "NFT"
                        ? `Token #${asset.tokenId ?? "?"}`
                        : (asset.symbol ?? "")}
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs ${
                        asset.type === "NFT"
                          ? "bg-purple-900/40 text-purple-400"
                          : "bg-blue-900/40 text-blue-400"
                      }`}
                    >
                      {asset.type}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between border-t border-gray-800 pt-2">
                    <span className="text-xs text-gray-500">Balance</span>
                    <span className="text-sm font-medium text-white">
                      {formatBalance(asset.balance, asset.decimals)}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-xs text-gray-500">Chain</span>
                    <span className="text-xs text-gray-400">Chain {asset.chainId}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded-lg border border-gray-800 bg-gray-900 px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 disabled:opacity-50"
              >
                ← Prev
              </button>
              <span className="text-sm text-gray-400">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="rounded-lg border border-gray-800 bg-gray-900 px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 disabled:opacity-50"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Activity Feed ──────────────────────────────────────────────────────────

function ActivityFeed() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard/activity?limit=15")
      .then((res) => res.json())
      .then((data) => setActivities(data.activities ?? []))
      .catch(() => setActivities([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-lg border border-gray-800 bg-gray-900/50 p-3"
          >
            <div className="h-8 w-8 rounded-full bg-gray-800" />
            <div className="flex-1">
              <div className="h-4 w-3/4 rounded bg-gray-800" />
              <div className="mt-1 h-3 w-1/2 rounded bg-gray-800" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-6 text-center">
        <p className="text-gray-400">No recent activity. Sync your wallet to get started.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {activities.map((a) => (
        <div
          key={a.id}
          className="flex items-center gap-3 rounded-lg border border-gray-800 bg-gray-900/50 p-3 transition-colors hover:border-gray-700"
        >
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm ${
              a.action === "added" ? "bg-green-900/40" : "bg-blue-900/40"
            }`}
          >
            {a.action === "added" ? "✨" : "🔄"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-white">
              <span className="font-medium">{a.assetName}</span>
              <span className="text-gray-400"> ({a.assetType})</span>
            </p>
            <p className="text-xs text-gray-500">
              {a.action === "added" ? "Added to portfolio" : "Balance updated"} ·{" "}
              {formatRelativeTime(a.timestamp)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main Dashboard Page ────────────────────────────────────────────────────

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [allocation, setAllocation] = useState<AllocationData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/dashboard/summary").then((r) => r.json()),
      fetch("/api/dashboard/allocation").then((r) => r.json()),
    ])
      .then(([summaryData, allocationData]) => {
        setSummary(summaryData);
        setAllocation(allocationData);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-gray-400">Overview of your Enjin NFT portfolio</p>
      </div>

      {/* Overview Cards */}
      <OverviewCards summary={summary} />

      {/* Allocation Charts */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-white">Allocation</h2>
        <AllocationCharts allocation={allocation} />
      </div>

      {/* Asset Grid */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-white">Assets</h2>
        <AssetGrid />
      </div>

      {/* Activity Feed */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-white">Recent Activity</h2>
        <ActivityFeed />
      </div>
    </div>
  );
}
