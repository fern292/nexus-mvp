import { prisma } from "@/lib/prisma";
// Prisma 7 doesn't export model types from @prisma/client in Vercel builds
type Alert = {
  id: string;
  userId: string;
  type: AlertType;
  assetId: string | null;
  threshold: { toString: () => string } | null;
  channel: NotificationChannel;
  condition: unknown;
  isActive: boolean;
  triggeredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};
type AlertType = "PRICE_ABOVE" | "PRICE_BELOW" | "NEW_ASSET" | "VALUE_DROP";
type NotificationChannel = "EMAIL" | "DISCORD" | "INAPP";

const COINGECKO_BASE = "https://api.coingecko.com/api/v3";

export interface PriceData {
  [contract_or_id: string]: {
    usd: number;
    usd_24h_change?: number;
  };
}

/**
 * Fetch token prices from CoinGecko's free API.
 * Uses contract addresses on Ethereum.
 */
export async function fetchTokenPrices(
  contracts: string[],
  chainId: number = 1
): Promise<PriceData> {
  if (contracts.length === 0) return {};

  // CoinGecko Ethereum contract address endpoint
  const platform = chainId === 1 ? "ethereum" : "polygon-pos";
  const addressList = contracts.join(",");

  try {
    const res = await fetch(
      `${COINGECKO_BASE}/simple/token_price/${platform}?contract_addresses=${addressList}&vs_currencies=usd&include_24hr_change=true`,
      {
        headers: { Accept: "application/json" },
        next: { revalidate: 60 },
      }
    );

    if (!res.ok) {
      console.error(`[CoinGecko] HTTP ${res.status}: ${res.statusText}`);
      return {};
    }

    return await res.json();
  } catch (err) {
    console.error("[CoinGecko] Fetch error:", err);
    return {};
  }
}

/**
 * Fetch simple coin prices by CoinGecko IDs.
 */
export async function fetchCoinPrices(ids: string[]): Promise<PriceData> {
  if (ids.length === 0) return {};

  try {
    const res = await fetch(
      `${COINGECKO_BASE}/simple/price?ids=${ids.join(",")}&vs_currencies=usd&include_24hr_change=true`,
      {
        headers: { Accept: "application/json" },
        next: { revalidate: 60 },
      }
    );

    if (!res.ok) return {};
    return await res.json();
  } catch {
    return {};
  }
}

export interface CheckResult {
  alertId: string;
  triggered: boolean;
  message?: string;
  price?: number;
}

/**
 * Evaluate a single alert against current data.
 */
export function evaluateAlert(
  alert: Alert & {
    asset: { contract: string; symbol: string | null; name: string | null; balance: string } | null;
  },
  prices: PriceData
): CheckResult {
  const result: CheckResult = { alertId: alert.id, triggered: false };

  switch (alert.type) {
    case "PRICE_ABOVE":
    case "PRICE_BELOW": {
      if (!alert.asset || !alert.threshold) {
        return result;
      }
      const priceData = prices[alert.asset.contract.toLowerCase()];
      if (!priceData) return result;

      const price = priceData.usd;
      const threshold = parseFloat(alert.threshold.toString());

      if (alert.type === "PRICE_ABOVE" && price >= threshold) {
        result.triggered = true;
        result.price = price;
        result.message = `${alert.asset.name || alert.asset.symbol} price is $${price.toFixed(2)} (above $${threshold})`;
      } else if (alert.type === "PRICE_BELOW" && price <= threshold) {
        result.triggered = true;
        result.price = price;
        result.message = `${alert.asset.name || alert.asset.symbol} price is $${price.toFixed(2)} (below $${threshold})`;
      }
      break;
    }

    case "VALUE_DROP": {
      if (!alert.asset) return result;
      const priceData = prices[alert.asset.contract.toLowerCase()];
      if (!priceData || priceData.usd_24h_change === undefined) return result;

      const dropThreshold = alert.threshold ? parseFloat(alert.threshold.toString()) : 10; // default 10% drop

      if (priceData.usd_24h_change <= -dropThreshold) {
        result.triggered = true;
        result.price = priceData.usd;
        result.message = `${alert.asset.name || alert.asset.symbol} dropped ${Math.abs(priceData.usd_24h_change).toFixed(1)}% in 24h (now $${priceData.usd.toFixed(2)})`;
      }
      break;
    }

    case "NEW_ASSET": {
      // Handled by the indexer — checked when new assets are synced
      break;
    }
  }

  return result;
}

/**
 * Deliver a notification via the configured channel.
 */
async function deliverNotification(
  userId: string,
  alertId: string | null,
  channel: NotificationChannel,
  title: string,
  message: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  switch (channel) {
    case "INAPP":
      await prisma.notification.create({
        data: {
          userId,
          alertId,
          title,
          message,
          channel: "INAPP",
          metadata: metadata as never,
        },
      });
      break;

    case "EMAIL":
      // Store in DB + send via Resend if configured
      await prisma.notification.create({
        data: {
          userId,
          alertId,
          title,
          message,
          channel: "EMAIL",
          metadata: metadata as never,
        },
      });

      // Send via Resend if API key is configured
      if (process.env.RESEND_API_KEY) {
        try {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: process.env.EMAIL_FROM || "alerts@nexus.local",
              to: metadata?.email as string,
              subject: title,
              text: message,
            }),
          });
        } catch (err) {
          console.error("[Notification] Email send error:", err);
        }
      }
      break;

    case "DISCORD":
      // Store in DB + post to Discord webhook if configured
      await prisma.notification.create({
        data: {
          userId,
          alertId,
          title,
          message,
          channel: "DISCORD",
          metadata: metadata as never,
        },
      });

      if (metadata?.discordWebhookUrl) {
        try {
          await fetch(metadata.discordWebhookUrl as string, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              embeds: [
                {
                  title,
                  description: message,
                  color: 0xff6b6b,
                  timestamp: new Date().toISOString(),
                },
              ],
            }),
          });
        } catch (err) {
          console.error("[Notification] Discord webhook error:", err);
        }
      }
      break;
  }
}

/**
 * Run the full alert checking cycle.
 * Fetches all active alerts, gets prices, evaluates conditions, and triggers notifications.
 */
export async function checkAllAlerts(userId?: string): Promise<CheckResult[]> {
  const where = {
    isActive: true,
    ...(userId ? { userId } : {}),
  };

  const alerts: Array<Alert & {
    asset: { contract: string; symbol: string | null; name: string | null; balance: string; chainId: number } | null;
  }> = await prisma.alert.findMany({
    where,
    include: {
      asset: {
        select: {
          contract: true,
          symbol: true,
          name: true,
          balance: true,
          chainId: true,
        },
      },
    },
  });

  // Collect unique contract addresses for price fetching
  const priceAlerts = alerts.filter(
    (a) => a.type === "PRICE_ABOVE" || a.type === "PRICE_BELOW" || a.type === "VALUE_DROP"
  );
  const contracts = Array.from(
    new Set(priceAlerts.filter((a) => a.asset).map((a) => a.asset!.contract.toLowerCase()))
  );
  const chainIds = Array.from(new Set(priceAlerts.map((a) => a.asset?.chainId ?? 1)));

  // Fetch prices (use Ethereum mainnet as primary)
  const prices: PriceData = {};
  for (const chainId of chainIds) {
    const chainAlerts = priceAlerts.filter((a) => (a.asset?.chainId ?? 1) === chainId);
    const chainContracts = Array.from(
      new Set(chainAlerts.filter((a) => a.asset).map((a) => a.asset!.contract.toLowerCase()))
    );
    const chainPrices = await fetchTokenPrices(chainContracts, chainId);
    Object.assign(prices, chainPrices);
  }

  // Evaluate all alerts
  const results: CheckResult[] = [];

  for (const alert of alerts) {
    const check = evaluateAlert(alert as never, prices);
    results.push(check);

    if (check.triggered && check.message) {
      // Determine notification metadata
      const metadata: Record<string, unknown> = {
        price: check.price,
        alertType: alert.type,
        threshold: alert.threshold?.toString(),
      };

      // Add channel-specific metadata
      if (alert.channel === "EMAIL") {
        const user = await prisma.user.findUnique({
          where: { id: alert.userId },
          select: { email: true },
        });
        if (user?.email) metadata.email = user.email;
      }

      if (alert.channel === "DISCORD") {
        // Check for a global Discord webhook URL in env
        const discordWebhook = process.env.DISCORD_WEBHOOK_URL;
        if (discordWebhook) metadata.discordWebhookUrl = discordWebhook;
      }

      await deliverNotification(
        alert.userId,
        alert.id,
        alert.channel,
        `Alert: ${alert.type.replace("_", " ")}`,
        check.message,
        metadata
      );

      // Update alert's triggeredAt
      await prisma.alert.update({
        where: { id: alert.id },
        data: { triggeredAt: new Date() },
      });
    }
  }

  return results;
}
