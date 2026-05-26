"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";

// ── Types ──────────────────────────────────────────────────────────────────

type AlertType = "PRICE_ABOVE" | "PRICE_BELOW" | "NEW_ASSET" | "VALUE_DROP";
type NotificationChannel = "EMAIL" | "DISCORD" | "INAPP";

interface AlertTypeOption {
  value: AlertType;
  label: string;
  description: string;
}

interface ChannelOption {
  value: NotificationChannel;
  label: string;
  icon: string;
}

interface Alert {
  id: string;
  userId: string;
  type: AlertType;
  assetId: string | null;
  threshold: string | null;
  channel: NotificationChannel;
  condition: Record<string, unknown> | null;
  isActive: boolean;
  triggeredAt: string | null;
  createdAt: string;
  updatedAt: string;
  asset: {
    id: string;
    name: string | null;
    symbol: string | null;
    contract: string;
    type: string;
  } | null;
}

interface Notification {
  id: string;
  userId: string;
  alertId: string | null;
  title: string;
  message: string;
  channel: NotificationChannel;
  read: boolean;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

interface Asset {
  id: string;
  name: string | null;
  symbol: string | null;
  contract: string;
  type: string;
}

const ALERT_TYPES: AlertTypeOption[] = [
  {
    value: "PRICE_ABOVE",
    label: "Price Above",
    description: "Triggers when price goes above threshold",
  },
  {
    value: "PRICE_BELOW",
    label: "Price Below",
    description: "Triggers when price goes below threshold",
  },
  {
    value: "NEW_ASSET",
    label: "New Asset",
    description: "Triggers when a new asset appears in wallet",
  },
  {
    value: "VALUE_DROP",
    label: "Value Drop",
    description: "Triggers on significant price drop (24h)",
  },
];

const CHANNELS: ChannelOption[] = [
  { value: "INAPP", label: "In-App", icon: "🔔" },
  { value: "EMAIL", label: "Email", icon: "📧" },
  { value: "DISCORD", label: "Discord", icon: "💬" },
];

// ── Alert Form Modal ───────────────────────────────────────────────────────

function AlertFormModal({
  assets,
  onClose,
  onSubmit,
  loading,
}: {
  assets: Asset[];
  onClose: () => void;
  onSubmit: (data: {
    type: AlertType;
    assetId?: string;
    threshold?: string;
    channel: NotificationChannel;
  }) => void;
  loading: boolean;
}) {
  const [type, setType] = useState<AlertType>("PRICE_ABOVE");
  const [assetId, setAssetId] = useState<string>("");
  const [threshold, setThreshold] = useState<string>("");
  const [channel, setChannel] = useState<NotificationChannel>("INAPP");

  const needsThreshold = type === "PRICE_ABOVE" || type === "PRICE_BELOW";
  const needsAsset = type !== "NEW_ASSET";
  const needsPercentThreshold = type === "VALUE_DROP";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      type,
      ...(needsAsset && assetId ? { assetId } : {}),
      ...(needsThreshold || needsPercentThreshold ? { threshold: threshold } : {}),
      channel,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl border border-gray-800 bg-gray-900 p-6 shadow-xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Create Alert</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-800 hover:text-white"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Alert Type */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">Alert Type</label>
            <div className="grid grid-cols-2 gap-2">
              {ALERT_TYPES.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setType(opt.value)}
                  className={`rounded-lg border p-3 text-left text-sm transition-colors ${
                    type === opt.value
                      ? "border-blue-500 bg-blue-500/10 text-blue-400"
                      : "border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600"
                  }`}
                >
                  <div className="font-medium">{opt.label}</div>
                  <div className="mt-0.5 text-xs opacity-70">{opt.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Asset Selection */}
          {needsAsset && (
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">Asset</label>
              {assets.length > 0 ? (
                <select
                  value={assetId}
                  onChange={(e) => setAssetId(e.target.value)}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-sm text-white"
                  required
                >
                  <option value="">Select an asset...</option>
                  {assets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name || a.symbol || a.contract.slice(0, 10) + "..."}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-sm text-gray-500">No assets found. Sync your wallet first.</p>
              )}
            </div>
          )}

          {/* Threshold */}
          {needsThreshold && (
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Price Threshold (USD)
              </label>
              <input
                type="number"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                placeholder="e.g. 100.00"
                step="0.01"
                min="0"
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-sm text-white placeholder-gray-500"
                required
              />
            </div>
          )}

          {needsPercentThreshold && (
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Drop Threshold (%)
              </label>
              <input
                type="number"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                placeholder="e.g. 10"
                step="1"
                min="1"
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-sm text-white placeholder-gray-500"
              />
              <p className="mt-1 text-xs text-gray-500">Default: 10% if empty</p>
            </div>
          )}

          {/* Channel */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">
              Notification Channel
            </label>
            <div className="flex gap-2">
              {CHANNELS.map((ch) => (
                <button
                  key={ch.value}
                  type="button"
                  onClick={() => setChannel(ch.value)}
                  className={`flex-1 rounded-lg border p-3 text-center text-sm transition-colors ${
                    channel === ch.value
                      ? "border-blue-500 bg-blue-500/10 text-blue-400"
                      : "border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600"
                  }`}
                >
                  <div className="text-lg">{ch.icon}</div>
                  <div className="mt-1 font-medium">{ch.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-gray-700 px-4 py-2.5 text-sm font-medium text-gray-300 hover:bg-gray-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || (needsAsset && !assetId)}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create Alert"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Alert Card ─────────────────────────────────────────────────────────────

function AlertCard({
  alert,
  onToggle,
  onDelete,
}: {
  alert: Alert;
  onToggle: (id: string, isActive: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const typeInfo = ALERT_TYPES.find((t) => t.value === alert.type);
  const channelInfo = CHANNELS.find((c) => c.value === alert.channel);

  return (
    <div
      className={`rounded-lg border p-4 transition-colors ${
        alert.isActive
          ? "border-gray-800 bg-gray-900/50"
          : "border-gray-800/50 bg-gray-900/30 opacity-60"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-white">
              {typeInfo?.label || alert.type}
            </span>
            <span className="rounded-full bg-gray-800 px-2 py-0.5 text-xs text-gray-400">
              {channelInfo?.icon} {channelInfo?.label}
            </span>
            {alert.triggeredAt && (
              <span className="rounded-full bg-green-900/50 px-2 py-0.5 text-xs text-green-400">
                Triggered
              </span>
            )}
          </div>

          {alert.asset && (
            <p className="mt-1 text-sm text-gray-400">
              Asset:{" "}
              <span className="text-gray-300">
                {alert.asset.name ||
                  alert.asset.symbol ||
                  alert.asset.contract.slice(0, 16) + "..."}
              </span>
            </p>
          )}

          {alert.threshold && (
            <p className="mt-0.5 text-sm text-gray-400">
              Threshold:{" "}
              <span className="text-gray-300">
                {alert.type === "VALUE_DROP" ? `${alert.threshold}%` : `$${alert.threshold}`}
              </span>
            </p>
          )}

          <p className="mt-1 text-xs text-gray-500">
            Created {new Date(alert.createdAt).toLocaleDateString()}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Toggle Switch */}
          <button
            onClick={() => onToggle(alert.id, !alert.isActive)}
            className={`relative h-6 w-11 rounded-full transition-colors ${
              alert.isActive ? "bg-blue-600" : "bg-gray-700"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                alert.isActive ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>

          {/* Delete */}
          <button
            onClick={() => onDelete(alert.id)}
            className="rounded-lg p-2 text-gray-500 hover:bg-red-900/30 hover:text-red-400"
            title="Delete alert"
          >
            🗑
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Notification Panel ─────────────────────────────────────────────────────

function NotificationPanel({
  notifications,
  onClose,
  onMarkAllRead,
}: {
  notifications: Notification[];
  onClose: () => void;
  onMarkAllRead: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/40">
      <div className="h-full w-full max-w-md border-l border-gray-800 bg-gray-900 shadow-xl overflow-y-auto">
        <div className="sticky top-0 flex items-center justify-between border-b border-gray-800 bg-gray-900 px-4 py-3">
          <h2 className="text-lg font-semibold">Notifications</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={onMarkAllRead}
              className="rounded-lg px-3 py-1.5 text-xs text-blue-400 hover:bg-gray-800"
            >
              Mark all read
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-800 hover:text-white"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="p-4 space-y-2">
          {notifications.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">No notifications yet.</p>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className={`rounded-lg border p-3 text-sm ${
                  n.read ? "border-gray-800/50 bg-gray-900/30" : "border-blue-800/50 bg-blue-900/10"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium text-white">{n.title}</span>
                  <span className="text-xs text-gray-500 whitespace-nowrap">
                    {new Date(n.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="mt-1 text-gray-400">{n.message}</p>
                <span className="mt-1 inline-flex items-center rounded bg-gray-800 px-1.5 py-0.5 text-xs text-gray-500">
                  {CHANNELS.find((c) => c.value === n.channel)?.icon} {n.channel}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function AlertsPage() {
  const { data: session } = useSession();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch("/api/alerts");
      if (res.ok) {
        const json = await res.json();
        setAlerts(json.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch alerts:", err);
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const json = await res.json();
        setNotifications(json.data || []);
        setUnreadCount(json.unreadCount || 0);
      }
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
    }
  }, []);

  const fetchAssets = useCallback(async () => {
    try {
      const res = await fetch("/api/assets?limit=100");
      if (res.ok) {
        const json = await res.json();
        setAssets(json.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch assets:", err);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchAlerts(), fetchNotifications(), fetchAssets()]);
      setLoading(false);
    };
    if (session?.user) load();
  }, [session, fetchAlerts, fetchNotifications, fetchAssets]);

  const handleCreateAlert = async (data: {
    type: AlertType;
    assetId?: string;
    threshold?: string;
    channel: NotificationChannel;
  }) => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        setShowForm(false);
        await fetchAlerts();
      }
    } catch (err) {
      console.error("Failed to create alert:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleAlert = async (id: string, isActive: boolean) => {
    try {
      const res = await fetch(`/api/alerts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      if (res.ok) {
        setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, isActive } : a)));
      }
    } catch (err) {
      console.error("Failed to toggle alert:", err);
    }
  };

  const handleDeleteAlert = async (id: string) => {
    if (!confirm("Delete this alert?")) return;
    try {
      const res = await fetch(`/api/alerts/${id}`, { method: "DELETE" });
      if (res.ok) {
        setAlerts((prev) => prev.filter((a) => a.id !== id));
      }
    } catch (err) {
      console.error("Failed to delete alert:", err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await fetch("/api/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      });
      await fetchNotifications();
    } catch (err) {
      console.error("Failed to mark notifications read:", err);
    }
  };

  const handleManualCheck = async () => {
    try {
      const res = await fetch("/api/alerts/check", { method: "POST" });
      if (res.ok) {
        const json = await res.json();
        alert(`Checked ${json.checked} alerts, ${json.triggered} triggered.`);
        await fetchAlerts();
        await fetchNotifications();
      }
    } catch (err) {
      console.error("Failed to run alert check:", err);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Alerts</h1>
          <p className="text-gray-400">Set up price and event alerts</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-lg border border-gray-800 bg-gray-900/50"
            />
          ))}
        </div>
        <div className="h-48 animate-pulse rounded-lg border border-gray-800 bg-gray-900/50" />
      </div>
    );
  }

  const activeCount = alerts.filter((a) => a.isActive).length;
  const triggeredCount = alerts.filter((a) => a.triggeredAt).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Alerts</h1>
          <p className="text-gray-400">Set up price and event alerts for your portfolio</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Notifications Bell */}
          <button
            onClick={() => {
              setShowNotifications(true);
            }}
            className="relative rounded-lg border border-gray-800 p-2.5 text-gray-400 hover:bg-gray-800 hover:text-white"
          >
            🔔
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {/* Manual Check */}
          <button
            onClick={handleManualCheck}
            className="rounded-lg border border-gray-800 px-3 py-2 text-sm font-medium text-gray-300 hover:bg-gray-800 sm:px-4"
          >
            Run Check
          </button>

          {/* Create Alert */}
          <button
            onClick={() => setShowForm(true)}
            className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 sm:px-4"
          >
            + New Alert
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-4">
          <p className="text-sm text-gray-400">Total Alerts</p>
          <p className="mt-1 text-2xl font-bold">{alerts.length}</p>
        </div>
        <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-4">
          <p className="text-sm text-gray-400">Active</p>
          <p className="mt-1 text-2xl font-bold text-green-400">{activeCount}</p>
        </div>
        <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-4">
          <p className="text-sm text-gray-400">Triggered</p>
          <p className="mt-1 text-2xl font-bold text-blue-400">{triggeredCount}</p>
        </div>
      </div>

      {/* Alerts List */}
      {alerts.length === 0 ? (
        <div className="rounded-lg border border-gray-800 p-12 text-center">
          <div className="text-4xl mb-3">🔔</div>
          <h3 className="text-lg font-semibold text-white">No alerts yet</h3>
          <p className="mt-1 text-sm text-gray-400">
            Create your first alert to get notified about price changes and new assets.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-4 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Create Alert
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <AlertCard
              key={alert.id}
              alert={alert}
              onToggle={handleToggleAlert}
              onDelete={handleDeleteAlert}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {showForm && (
        <AlertFormModal
          assets={assets}
          onClose={() => setShowForm(false)}
          onSubmit={handleCreateAlert}
          loading={submitting}
        />
      )}

      {showNotifications && (
        <NotificationPanel
          notifications={notifications}
          onClose={() => setShowNotifications(false)}
          onMarkAllRead={handleMarkAllRead}
        />
      )}
    </div>
  );
}
