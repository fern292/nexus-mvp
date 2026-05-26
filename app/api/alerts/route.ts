import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkAllAlerts } from "@/lib/alert-checker";
type AlertType = "PRICE_ABOVE" | "PRICE_BELOW" | "NEW_ASSET" | "VALUE_DROP";
type NotificationChannel = "EMAIL" | "DISCORD" | "INAPP";

/**
 * GET /api/alerts
 * List all alerts for the current user.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const alerts = await prisma.alert.findMany({
      where: { userId: session.user.id },
      include: {
        asset: {
          select: {
            id: true,
            name: true,
            symbol: true,
            contract: true,
            type: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data: alerts });
  } catch (err) {
    console.error("[GET /api/alerts] Error:", err);
    return NextResponse.json({ error: "Failed to fetch alerts" }, { status: 500 });
  }
}

/**
 * POST /api/alerts
 * Create a new alert.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { type, assetId, threshold, channel, condition } = body as {
      type: AlertType;
      assetId?: string;
      threshold?: string | number;
      channel?: NotificationChannel;
      condition?: Record<string, unknown>;
    };

    if (!type) {
      return NextResponse.json({ error: "Alert type is required" }, { status: 400 });
    }

    // Validate alert type
    const validTypes: AlertType[] = ["PRICE_ABOVE", "PRICE_BELOW", "NEW_ASSET", "VALUE_DROP"];
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: "Invalid alert type" }, { status: 400 });
    }

    // Validate channel
    const validChannels: NotificationChannel[] = ["EMAIL", "DISCORD", "INAPP"];
    if (channel && !validChannels.includes(channel)) {
      return NextResponse.json({ error: "Invalid notification channel" }, { status: 400 });
    }

    // If assetId is provided, verify it belongs to the user
    if (assetId) {
      const asset = await prisma.asset.findFirst({
        where: {
          id: assetId,
          wallet: { userId: session.user.id },
        },
      });
      if (!asset) {
        return NextResponse.json(
          { error: "Asset not found or not owned by user" },
          { status: 404 }
        );
      }
    }

    const alert = await prisma.alert.create({
      data: {
        userId: session.user.id,
        type,
        assetId: assetId || null,
        threshold: threshold ? threshold.toString() : null,
        channel: channel || "INAPP",
        condition: condition ? (condition as never) : undefined,
        isActive: true,
      },
      include: {
        asset: {
          select: {
            id: true,
            name: true,
            symbol: true,
            contract: true,
            type: true,
          },
        },
      },
    });

    return NextResponse.json({ data: alert }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/alerts] Error:", err);
    return NextResponse.json({ error: "Failed to create alert" }, { status: 500 });
  }
}
